import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * How long opening a connection may take. Normally ~1-2s, but over a degraded route to
 * Supabase (seen 2026-11-13) the TLS handshake and login took 6s to 2 minutes, while
 * queries on an open connection still took ~0.2s. So connecting gets room, and the
 * pool keeps connections open (`min`) so pages rarely have to connect at all.
 */
export const CONNECT_TIMEOUT_S = 30;

/**
 * Longest any single query may take, including waiting for and opening a connection.
 * Ours take well under a second once connected; this must stay above CONNECT_TIMEOUT_S,
 * or a slow connection would be mistaken for a stuck one and the pool thrown away
 * before it ever finished connecting.
 */
export const QUERY_TIMEOUT_MS = 45_000;

/**
 * Puts a time limit on every query sent through `client.unsafe` (all of
 * Drizzle's queries go through it). postgres.js has no client-side limit once a
 * query is sent, so a query on a socket the Supabase pooler silently dropped
 * would wait forever and the page would never finish loading. Instead it
 * rejects with code QUERY_TIMEOUT and `onTimeout` is told, so the pool can be replaced.
 *
 * The query object is returned as-is (its chainable methods like `.values()`
 * still work); only awaiting it is raced against the timer.
 */
export function withQueryTimeout<C extends { unsafe: (...args: never[]) => PromiseLike<unknown> }>(
  client: C,
  ms: number,
  onTimeout: (err: Error) => void,
): C {
  const send = client.unsafe.bind(client) as (...args: unknown[]) => PromiseLike<unknown>;
  (client as { unsafe: unknown }).unsafe = (...args: unknown[]) => {
    const query = send(...args);
    const run = query.then.bind(query);
    (query as { then: unknown }).then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = Object.assign(new Error(`Database query took longer than ${ms / 1000}s`), { code: "QUERY_TIMEOUT" });
          onTimeout(err);
          reject(err);
        }, ms);
      });
      return Promise.race([run((v) => v), timedOut])
        .finally(() => clearTimeout(timer))
        .then(onFulfilled, onRejected);
    };
    return query;
  };
  return client;
}

export function createDb(url = process.env.DATABASE_URL, opts: { onStuck?: (err: Error) => void } = {}) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, {
      // Supabase's transaction pooler (port 6543) doesn't support prepared statements.
      prepare: false,
      // One query at a time per connection. postgres.js v4 pipelines up to 100 by default,
      // and Supabase's pooler (Supavisor) jams on pipelined queries: in a burst like a page
      // load, ~90 of 96 queries hung with pipelining on, against ~96 of 96 answered with it off
      // (measured 2026-11-13). The jam also starves the pooler for every other client.
      max_pipeline: 1,
      max: 5,
      // Two connections stay open once the pool is used, so a page load reuses them
      // instead of paying for a new handshake (which can be very slow, see CONNECT_TIMEOUT_S).
      // keep_alive below stops routers and the pooler from silently dropping them while idle.
      min: 2,
      // Extra connections above `min` close after a quiet minute; every connection is
      // recycled after 30 minutes so none lives on a stale socket forever.
      idle_timeout: 60,
      max_lifetime: 30 * 60,
      connect_timeout: CONNECT_TIMEOUT_S,
      // Fail a request rather than hang it when every connection is busy or stuck
      // (long enough to cover opening a connection). app/_server/engine.ts then replaces the pool.
      queue_timeout: 40,
      // TCP keep-alive probes after 10s of silence (default 60s): keeps idle connections
      // alive through NAT, and makes a socket the pooler dropped error out sooner.
      keep_alive: 10,
  });
  // And a hard limit per query, for sockets that never error out at all.
  withQueryTimeout(client, QUERY_TIMEOUT_MS, (err) => opts.onStuck?.(err));
  return drizzle(client, { schema });
}

/**
 * Driver error codes meaning the connections themselves are dead or stuck, as
 * opposed to the database answering "no". Retrying on the same pool won't help.
 */
const STUCK_CODES = new Set([
  "QUERY_TIMEOUT",
  "QUEUE_TIMEOUT",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
]);

/** The first driver error code in an error or its `cause` chain (Drizzle wraps driver errors). */
function driverCode(err: unknown): string | undefined {
  for (let e = err, depth = 0; e && typeof e === "object" && depth < 3; e = (e as { cause?: unknown }).cause, depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/** True for a stuck-pool error, also when Drizzle has wrapped it ("Failed query: ..." with a `cause`). */
export function isStuckDbError(err: unknown): boolean {
  const code = driverCode(err);
  return code !== undefined && STUCK_CODES.has(code);
}

/**
 * Whether to throw the pool away and start a fresh one. Not for CONNECT_TIMEOUT: when
 * connecting itself is slow, a new pool connects just as slowly, and discarding the
 * half-open one only restarts the wait.
 */
export function shouldReplacePool(err: unknown): boolean {
  return isStuckDbError(err) && driverCode(err) !== "CONNECT_TIMEOUT";
}

export type Db = ReturnType<typeof createDb>;
