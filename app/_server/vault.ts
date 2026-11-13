import "server-only";

import { dec, sum, toDecimalString, ZERO } from "@/engine/decimal";
import { accessibleBalance } from "@/engine";
import { sortLockViews, toLockView, type LockView } from "@/app/_lib/lock-view";
import { getCurrentUser } from "./current-user";
import { getEngine } from "./engine";
import { gatewayFailure, type GatewayFailure } from "./gateway-failure";
import { priceMap } from "./wallet";

export interface VaultData {
  active: LockView[];
  finished: LockView[];
  totalLockedUsd: string;
  nextRelease?: { lock: LockView; releaseAt: Date; amount: string };
}

async function loadAll() {
  const engine = getEngine();
  const user = await getCurrentUser(engine);
  const [balances, locks] = await Promise.all([engine.client.getBalances(user.gatewayUserId), engine.store.listLocks(user.id)]);
  const prices = await priceMap(engine, user, balances);
  const now = new Date();
  return { balances, locks, now, views: locks.map((l) => toLockView(l, now, prices.get(l.assetId) ?? ZERO)) };
}

async function lockViews() {
  return (await loadAll()).views;
}

/** Every lock: active ones by next release, then finished ones. */
export async function loadVault(): Promise<{ ok: true; data: VaultData } | GatewayFailure> {
  const engine = getEngine();
  try {
    const { active, finished } = sortLockViews(await lockViews());
    const first = active.find((v) => v.next);
    return {
      ok: true,
      data: {
        active,
        finished,
        totalLockedUsd: toDecimalString(sum(active.map((v) => dec(v.lockedUsd))), 6),
        nextRelease: first?.next ? { lock: first, releaseAt: first.next.releaseAt, amount: first.next.amount } : undefined,
      },
    };
  } catch (err) {
    return gatewayFailure(engine, err);
  }
}

/**
 * One of the signed-in user's locks, or null if it isn't theirs or doesn't exist,
 * plus how much of that asset is free to withdraw right now (wallet minus every lock on it).
 */
export async function loadLock(lockId: string): Promise<{ ok: true; lock: LockView | null; freeAmount: string } | GatewayFailure> {
  const engine = getEngine();
  try {
    const { balances, locks, now, views } = await loadAll();
    const lock = views.find((v) => v.id === lockId) ?? null;
    const freeAmount = lock ? toDecimalString(accessibleBalance(lock.assetId, { balances, locks, now }).accessible) : "0";
    return { ok: true, lock, freeAmount };
  } catch (err) {
    return gatewayFailure(engine, err);
  }
}
