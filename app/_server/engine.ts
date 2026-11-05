import "server-only";

import { createDb, type Db } from "@/db/client";
import { DrizzleVaultStore } from "@/db/store";
import { createEngine, loadEngineConfig, MemoryVaultStore, type Engine } from "@/engine";

// One engine per server process. Kept on globalThis so dev hot reloads don't
// rebuild it (and lose in-memory locks) on every edit. Rebuilt if the mode or
// database setting changes, e.g. after editing .env.
const g = globalThis as typeof globalThis & { __vault?: { key: string; engine: Engine; db: Db | null } };

function current() {
  const key = `${process.env.GATEWAY_MODE ?? "mock"}|${process.env.DATABASE_URL ? "db" : "memory"}`;
  if (g.__vault?.key !== key) {
    const db = process.env.DATABASE_URL ? createDb() : null;
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
