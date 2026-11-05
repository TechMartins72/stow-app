import "server-only";

import { sql } from "drizzle-orm";
import { createDb, type Db } from "@/db/client";
import { users } from "@/db/schema";
import { DrizzleVaultStore } from "@/db/store";
import { createEngine, loadEngineConfig, MemoryVaultStore, type Engine, type GuardUser } from "@/engine";

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

/**
 * The signed-in user. There is no sign-in yet, so this is the dev user from
 * DEV_USER_REF, the same one the dev scripts use. Creating the Gateway user is
 * idempotent per external ref and moves no money. With a database, the dev
 * user also gets a `users` row so locks can reference it.
 */
export async function getCurrentUser(engine: Engine): Promise<GuardUser> {
  const ref = process.env.DEV_USER_REF ?? "dev_user_1";
  const gatewayUser = await engine.client.createUser(ref, engine.guard.signerPublicKey);
  const { db } = current();
  if (!db) return { id: `dev:${ref}`, gatewayUserId: gatewayUser.user_id };

  // `.invalid` can never be a real address (RFC 2606).
  const email = `${ref}@dev.invalid`;
  const [row] = await db
    .insert(users)
    .values({ email, gatewayUserId: gatewayUser.user_id })
    // A restarted mock hands out a new Gateway id for the same dev user.
    .onConflictDoUpdate({ target: users.email, set: { gatewayUserId: sql`excluded.gateway_user_id` } })
    .returning({ id: users.id });
  return { id: row.id, gatewayUserId: gatewayUser.user_id };
}
