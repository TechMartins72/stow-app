import "server-only";

import { eq } from "drizzle-orm";
import { createDb, isStuckDbError, shouldReplacePool, type Db } from "@/db/client";
import { databaseModeProblem } from "@/db/database-mode";
import { appSettings } from "@/db/schema";
import { DrizzleVaultStore } from "@/db/store";
import { createEngine, loadEngineConfig, MemoryVaultStore, type Engine } from "@/engine";

// One engine per server process. Kept on globalThis so dev hot reloads don't
// rebuild it (and lose in-memory locks) on every edit. Rebuilt if the mode or
// database setting changes, e.g. after editing .env, or after its database
// connections got stuck (see recoverFromDbError).
const g = globalThis as typeof globalThis & {
  __vault?: { key: string; engine: Engine; db: Db | null; modeChecked?: Promise<void> };
  __dbRecoveredAt?: number;
};

/**
 * Makes sure this database belongs to the current Gateway mode (see
 * db/database-mode.ts): an unmarked database is claimed, a practice database
 * refuses live mode and the other way round. Checked once per engine.
 */
export function ensureDatabaseMode(): Promise<void> {
  const vault = current();
  const db = vault.db;
  if (!db) return Promise.resolve();
  vault.modeChecked ??= (async () => {
    const mode = vault.engine.config.mode;
    await db.insert(appSettings).values({ key: "gateway_mode", value: mode }).onConflictDoNothing();
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, "gateway_mode"));
    const problem = databaseModeProblem(row?.value ?? null, mode);
    if (problem) throw new Error(problem);
  })().catch((err) => {
    vault.modeChecked = undefined; // check again next time (after a fix, or a database hiccup)
    throw err;
  });
  return vault.modeChecked;
}

function current() {
  const key = `${process.env.GATEWAY_MODE ?? "mock"}|${process.env.DATABASE_URL ? "db" : "memory"}`;
  if (g.__vault?.key !== key) {
    // A query that times out reports here at once, so the next request already gets a fresh pool.
    const db = process.env.DATABASE_URL ? createDb(undefined, { onStuck: recoverFromDbError }) : null;
    const store = db ? new DrizzleVaultStore(db) : new MemoryVaultStore();
    g.__vault = { key, engine: createEngine(loadEngineConfig(), store), db };
  }
  return g.__vault;
}

export function getEngine(): Engine {
  return current().engine;
}

/** The Postgres connection, or null when running on in-memory stores. */
export function getDb(): Db | null {
  return current().db;
}

/** Old pools can keep reporting errors for a while after they've been replaced; don't let them kill the new one. */
const RECOVERY_COOLDOWN_MS = 20_000;

/**
 * Called with errors from database work. If the pool's connections are dead or
 * stuck (the Supabase pooler sometimes drops them mid-query), closes them and
 * lets the next request build a fresh engine and pool, instead of every request
 * failing until the server restarts. Ordinary errors are left alone.
 * Returns true when it replaced the pool.
 */
export function recoverFromDbError(err: unknown): boolean {
  const old = g.__vault;
  if (!old?.db || !shouldReplacePool(err)) return false;
  if (Date.now() - (g.__dbRecoveredAt ?? 0) < RECOVERY_COOLDOWN_MS) return false;
  g.__dbRecoveredAt = Date.now();
  g.__vault = undefined;
  console.warn("[db] connections were stuck; closing them and opening a fresh pool");
  // Queries still running on the old pool's healthy connections get 15 seconds to finish, so
  // other requests mid-way aren't cut off (CONNECTION_ENDED); stuck ones time out on their own.
  old.db.$client.end({ timeout: 15 }).catch(() => {});
  return true;
}

/**
 * Runs a read, and if it failed because the pool was stuck, runs it once more
 * on a fresh pool. Only for reads: anything that changes data or moves money
 * must never be retried automatically.
 */
export async function retryReadIfDbStuck<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (err) {
    if (!isStuckDbError(err)) throw err;
    recoverFromDbError(err);
    return read();
  }
}
