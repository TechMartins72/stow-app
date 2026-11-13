import { describe, expect, it, vi } from "vitest";
import { CONNECT_TIMEOUT_S, isStuckDbError, QUERY_TIMEOUT_MS, shouldReplacePool, withQueryTimeout } from "./client";

/** A stand-in for postgres.js's lazy query: a promise with chainable `.values()`. */
function fakeQuery<T>(result: Promise<T>) {
  const q = Object.assign(result.then((v) => v), {
    mode: "rows" as string,
    values() {
      q.mode = "values";
      return q;
    },
  });
  return q;
}

describe("withQueryTimeout", () => {
  it("passes results through, and keeps `.values()` working", async () => {
    const client = { unsafe: () => fakeQuery(Promise.resolve([{ id: 1 }])) };
    withQueryTimeout(client, 1000, () => {});
    const q = client.unsafe().values();
    expect(q.mode).toBe("values");
    await expect(q).resolves.toEqual([{ id: 1 }]);
  });

  it("rejects a query that never answers, with a stuck-pool error, and reports it", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const client = { unsafe: () => fakeQuery(new Promise<never>(() => {})) };
    withQueryTimeout(client, 10_000, onTimeout);
    const pending = expect(client.unsafe()).rejects.toMatchObject({ code: "QUERY_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(isStuckDbError(onTimeout.mock.calls[0][0])).toBe(true);
    vi.useRealTimers();
  });

  it("passes a database error through untouched", async () => {
    const client = { unsafe: () => fakeQuery(Promise.reject(Object.assign(new Error("duplicate"), { code: "23505" }))) };
    withQueryTimeout(client, 1000, () => {});
    await expect(client.unsafe()).rejects.toMatchObject({ code: "23505" });
  });
});

describe("isStuckDbError", () => {
  it("recognises a pool whose connections are dead or busy forever", () => {
    expect(isStuckDbError({ code: "QUEUE_TIMEOUT" })).toBe(true);
    expect(isStuckDbError({ code: "CONNECTION_CLOSED" })).toBe(true);
    expect(isStuckDbError({ code: "CONNECT_TIMEOUT" })).toBe(true);
    expect(isStuckDbError({ code: "ECONNRESET" })).toBe(true);
  });

  it("looks through Drizzle's wrapper to the driver's error", () => {
    const wrapped = Object.assign(new Error("Failed query: select ..."), { cause: { code: "QUEUE_TIMEOUT" } });
    expect(isStuckDbError(wrapped)).toBe(true);
  });

  it("ignores ordinary query errors and non-errors", () => {
    expect(isStuckDbError({ code: "23505" })).toBe(false); // unique violation: a real answer from the database
    expect(isStuckDbError(new Error("boom"))).toBe(false);
    expect(isStuckDbError(null)).toBe(false);
    expect(isStuckDbError("QUEUE_TIMEOUT")).toBe(false);
  });
});

describe("shouldReplacePool", () => {
  it("replaces the pool when its connections are stuck or dead", () => {
    expect(shouldReplacePool({ code: "QUERY_TIMEOUT" })).toBe(true);
    expect(shouldReplacePool({ code: "QUEUE_TIMEOUT" })).toBe(true);
    expect(shouldReplacePool({ cause: { code: "CONNECTION_CLOSED" } })).toBe(true);
  });

  // Seen live: opening a connection took 6s to 2 min over a slow route. A fresh pool
  // would connect just as slowly, and throwing away the half-open one restarts the wait.
  it("keeps the pool when the problem is only that connecting is slow", () => {
    expect(shouldReplacePool({ code: "CONNECT_TIMEOUT" })).toBe(false);
    expect(shouldReplacePool({ cause: { code: "CONNECT_TIMEOUT" } })).toBe(false);
  });

  it("keeps the pool for ordinary query errors", () => {
    expect(shouldReplacePool({ code: "23505" })).toBe(false);
  });
});

describe("timeouts", () => {
  it("allow more time per query than connecting may take, so a slow connection isn't mistaken for a stuck one", () => {
    expect(QUERY_TIMEOUT_MS).toBeGreaterThan(CONNECT_TIMEOUT_S * 1000);
  });
});
