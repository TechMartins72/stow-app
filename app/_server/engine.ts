import "server-only";

import { createDb } from "@/db/client";
import { DrizzleVaultStore } from "@/db/store";
import { createEngine, loadEngineConfig, MemoryVaultStore, type Engine, type GuardUser } from "@/engine";

// One engine per server process. Kept on globalThis so dev hot reloads don't
// create a new store (and lose in-memory locks) on every edit.
const g = globalThis as typeof globalThis & { __vaultEngine?: Engine };

export function getEngine(): Engine {
  if (!g.__vaultEngine) {
    const store = process.env.DATABASE_URL ? new DrizzleVaultStore(createDb()) : new MemoryVaultStore();
    g.__vaultEngine = createEngine(loadEngineConfig(), store);
  }
  return g.__vaultEngine;
}

/**
 * The signed-in user. There is no sign-in yet, so this is the dev user from
 * DEV_USER_REF, the same one the dev scripts use. Creating a user is
 * idempotent per external ref and moves no money.
 */
export async function getCurrentUser(engine: Engine): Promise<GuardUser> {
  const ref = process.env.DEV_USER_REF ?? "dev_user_1";
  const user = await engine.client.createUser(ref, engine.guard.signerPublicKey);
  return { id: `dev:${ref}`, gatewayUserId: user.user_id };
}
