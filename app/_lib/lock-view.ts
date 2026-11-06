// What the screens show about a lock, computed from the engine's rules at `now`.
// Pure: no I/O, so it's shared by Home, the Vault list and the lock detail.

import { dec, mul, toDecimalString, ZERO, type Dec } from "@/engine/decimal";
import { lockedNow, nextRelease, tranchesOf } from "@/engine/vault/schedule";
import type { Lock } from "@/engine/vault/types";

export interface LockPartView {
  releaseAt: Date;
  amount: string;
  released: boolean;
}

export interface LockView {
  id: string;
  goalName: string;
  assetId: string;
  symbol: string;
  /** The whole lock, released and not, and its value today. */
  amount: string;
  valueUsd: string;
  /** Still locked right now, and its value. */
  lockedAmount: string;
  lockedUsd: string;
  createdAt: Date;
  unlockAt: Date;
  /** Every part has freed itself (or the lock was closed). */
  finished: boolean;
  parts: number;
  partsReleased: number;
  /** Share of `amount` already released, 0..1. Display only. */
  releasedShare: number;
  next?: { releaseAt: Date; amount: string };
  schedule: LockPartView[];
}

export function toLockView(lock: Lock, now: Date, priceUsd: Dec): LockView {
  const parts = tranchesOf(lock);
  const stillLocked = lockedNow(lock, now);
  const total = dec(lock.amount);
  const next = nextRelease(lock, now);
  const closed = lock.status !== "active";
  return {
    id: lock.id,
    goalName: lock.goalName ?? `${lock.symbol} lock`,
    assetId: lock.assetId,
    symbol: lock.symbol,
    amount: lock.amount,
    valueUsd: toDecimalString(mul(total, priceUsd), 6),
    lockedAmount: toDecimalString(stillLocked),
    lockedUsd: toDecimalString(mul(stillLocked, priceUsd), 6),
    createdAt: lock.createdAt,
    unlockAt: lock.unlockAt,
    finished: stillLocked === ZERO,
    parts: parts.length,
    partsReleased: parts.filter((t) => closed || t.releaseAt <= now).length,
    releasedShare: total > ZERO ? Number(((total - stillLocked) * 10_000n) / total) / 10_000 : 0,
    next: next ? { releaseAt: next.releaseAt, amount: next.amount } : undefined,
    schedule: parts.map((t) => ({ releaseAt: t.releaseAt, amount: t.amount, released: closed || t.releaseAt <= now })),
  };
}

/** Soonest next release first; finished locks by when they finished, newest first. */
export function sortLockViews(views: LockView[]): { active: LockView[]; finished: LockView[] } {
  const active = views.filter((v) => !v.finished);
  const finished = views.filter((v) => v.finished);
  active.sort((a, b) => (a.next?.releaseAt ?? a.unlockAt).getTime() - (b.next?.releaseAt ?? b.unlockAt).getTime());
  finished.sort((a, b) => b.unlockAt.getTime() - a.unlockAt.getTime());
  return { active, finished };
}
