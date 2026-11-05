import { dec, toDecimalString, ZERO } from "../decimal";
import type { GatewayClient } from "../gateway/client";
import { accessibleBalance } from "./rules";
import type { NewLock, VaultStore } from "./store";
import type { Lock } from "./types";

export class LockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockError";
  }
}

/**
 * Creating a lock moves no funds: it reserves an amount the SigningGuard will
 * refuse to sign away. The amount must be accessible right now.
 */
export async function createLock(
  deps: { client: GatewayClient; store: VaultStore; now?: () => Date },
  gatewayUserId: string,
  input: NewLock,
): Promise<Lock> {
  const now = deps.now?.() ?? new Date();
  const amount = dec(input.amount);
  if (amount <= ZERO) throw new LockError("Lock amount must be more than zero.");
  if (input.unlockAt <= now) throw new LockError("Unlock date must be in the future.");

  const [balances, locks] = await Promise.all([
    deps.client.getBalances(gatewayUserId),
    deps.store.listLocks(input.userId),
  ]);
  const { accessible } = accessibleBalance(input.assetId, { balances, locks });
  if (amount > accessible) {
    throw new LockError(`Only ${toDecimalString(accessible, 6)} ${input.symbol} is available to lock.`);
  }
  return deps.store.insertLock(input, now);
}

/** Releases a matured lock back to the accessible balance. Never before its unlock date. */
export async function releaseLock(
  deps: { store: VaultStore; now?: () => Date },
  userId: string,
  lockId: string,
): Promise<Lock> {
  const now = deps.now?.() ?? new Date();
  const lock = (await deps.store.listLocks(userId)).find((l) => l.id === lockId);
  if (!lock) throw new LockError("Lock not found.");
  if (lock.status !== "active") throw new LockError("This lock is already closed.");
  if (now < lock.unlockAt) {
    throw new LockError(`This lock opens on ${lock.unlockAt.toISOString().slice(0, 10)}.`);
  }
  return deps.store.closeLock(lockId, "released", now);
}
