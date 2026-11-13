// The account summary on Home: where the money sits (cash, crypto, stocks) and
// what frees up next. Pure, so it's testable; amounts stay decimal strings.

import { dec, sum, toDecimalString, ZERO } from "@/engine/decimal";
import { tranchesOf } from "@/engine/vault/schedule";
import type { Asset } from "@/engine/gateway/types";
import type { Lock } from "@/engine/vault/types";

export type Bucket = "cash" | "crypto" | "stocks";

export const BUCKETS: { bucket: Bucket; label: string }[] = [
  { bucket: "cash", label: "Cash" },
  { bucket: "crypto", label: "Crypto" },
  { bucket: "stocks", label: "Stocks" },
];

export function bucketOf(a: Pick<Asset, "stable" | "asset_class">): Bucket {
  if (a.stable) return "cash";
  return a.asset_class === "stock" ? "stocks" : "crypto";
}

export interface AllocationSlice {
  bucket: Bucket;
  label: string;
  valueUsd: string;
  /** Share of the total in basis points (0..10000), rounded down. Display only. */
  bps: number;
}

/** Total value per bucket, always in the order cash, crypto, stocks. */
export function allocation(holdings: { bucket: Bucket; valueUsd: string }[]): AllocationSlice[] {
  const totals = BUCKETS.map(({ bucket }) => sum(holdings.filter((h) => h.bucket === bucket).map((h) => dec(h.valueUsd))));
  const grand = sum(totals);
  return BUCKETS.map(({ bucket, label }, i) => ({
    bucket,
    label,
    valueUsd: toDecimalString(totals[i], 6),
    // A ratio, not an amount: bigint first, then a small integer for the UI.
    bps: grand > ZERO ? Number((totals[i] * 10_000n) / grand) : 0,
  }));
}

export interface UpcomingRelease {
  lockId: string;
  goalName: string;
  assetId: string;
  symbol: string;
  releaseAt: Date;
  amount: string;
  /** 1-based position of this part in its lock, and how many parts the lock has. */
  part: number;
  parts: number;
}

/** The next `limit` parts to free themselves, across all active locks, soonest first. */
export function upcomingReleases(locks: Lock[], now: Date, limit: number): UpcomingRelease[] {
  const all: UpcomingRelease[] = [];
  for (const lock of locks) {
    if (lock.status !== "active") continue;
    const parts = tranchesOf(lock);
    parts.forEach((t, i) => {
      if (t.releaseAt <= now) return;
      all.push({
        lockId: lock.id,
        goalName: lock.goalName ?? `${lock.symbol} lock`,
        assetId: lock.assetId,
        symbol: lock.symbol,
        releaseAt: t.releaseAt,
        amount: t.amount,
        part: i + 1,
        parts: parts.length,
      });
    });
  }
  return all.sort((a, b) => a.releaseAt.getTime() - b.releaseAt.getTime()).slice(0, limit);
}
