import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { users } from "@/db/schema";
import type { Engine, GuardUser, Wallet } from "@/engine";
import { getDb } from "./engine";
import { readSession } from "./session";

/**
 * The signed-in user, with their Gateway wallets. Sends anyone without a valid
 * session to /signin. On first use, creates the user's True Markets user
 * (external_ref_id = our user id); that call is idempotent and moves no money.
 */
export async function getCurrentUser(engine: Engine): Promise<GuardUser & { email: string }> {
  const session = await readSession();
  if (!session) redirect("/signin");

  let gatewayUserId = session.gatewayUserId;
  // The mock forgets users when it restarts, so in mock mode always re-confirm.
  if (!gatewayUserId || engine.config.mode === "mock") {
    const created = await engine.client.createUser(session.userId, engine.guard.signerPublicKey);
    if (created.user_id !== gatewayUserId) {
      gatewayUserId = created.user_id;
      await getDb()?.update(users).set({ gatewayUserId }).where(eq(users.id, session.userId));
    }
  }
  return { id: session.userId, gatewayUserId: gatewayUserId!, email: session.email };
}

/** The user's deposit addresses. Same idempotent call as above; it returns the wallets. */
export async function getWallets(engine: Engine, user: GuardUser): Promise<Wallet[]> {
  return (await engine.client.createUser(user.id, engine.guard.signerPublicKey)).wallets;
}
