import "server-only";

import { dec, sum, toDecimalString, ZERO } from "@/engine/decimal";
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

async function lockViews() {
  const engine = getEngine();
  const user = await getCurrentUser(engine);
  const [balances, locks] = await Promise.all([engine.client.getBalances(user.gatewayUserId), engine.store.listLocks(user.id)]);
  const prices = await priceMap(engine, user, balances);
  const now = new Date();
  return locks.map((l) => toLockView(l, now, prices.get(l.assetId) ?? ZERO));
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

/** One of the signed-in user's locks, or null if it isn't theirs or doesn't exist. */
export async function loadLock(lockId: string): Promise<{ ok: true; lock: LockView | null } | GatewayFailure> {
  const engine = getEngine();
  try {
    return { ok: true, lock: (await lockViews()).find((v) => v.id === lockId) ?? null };
  } catch (err) {
    return gatewayFailure(engine, err);
  }
}
