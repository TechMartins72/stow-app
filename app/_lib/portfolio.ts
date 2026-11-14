// The Portfolio page's numbers: what each holding is worth, how much of it is free,
// locked or tied up in open orders, its share of the total, and the 24-hour change.
// Pure and decimal-only (CLAUDE.md rule 5); ratios become small integers only for display.

import { dec, max, min, mul, sum, toDecimalString, ZERO, type Dec } from "@/engine/decimal";
import type { Bucket } from "./home-summary";

export interface PortfolioInput {
  assetId: string;
  symbol: string;
  chain: string | null;
  bucket: Bucket;
  decimals: number;
  /** Everything in the wallet, including what open orders hold. */
  total: string;
  /** Held by open orders. */
  held: string;
  /** What locks hold right now (lockedNow summed over this asset's locks). */
  locked: string;
  priceUsd: string;
  /** Price at the start of the last 24 hours; null for cash or when market data has none. */
  priceDayAgoUsd: string | null;
}

export interface PortfolioRow extends PortfolioInput {
  /** Locked, capped at what's in the wallet outside open orders. */
  lockedQty: string;
  heldQty: string;
  /** Free to spend, send or lock. */
  freeQty: string;
  valueUsd: string;
  lockedUsd: string;
  /** Share of the whole portfolio in basis points, rounded down. Display only. */
  shareBps: number;
  /** Dollar change over 24 hours for what's held now; null when there's no price a day ago. */
  change24hUsd: string | null;
}

export interface Portfolio {
  rows: PortfolioRow[];
  totalUsd: string;
  lockedUsd: string;
  freeUsd: string;
  change24hUsd: string;
  /** 24-hour change against yesterday's value of today's holdings, in basis points. Display only. */
  change24hBps: number;
  byNetwork: { chain: string | null; valueUsd: string; bps: number }[];
}

const bpsOf = (part: Dec, whole: Dec) => (whole > ZERO ? Number((part * 10_000n) / whole) : 0);

export function portfolio(inputs: PortfolioInput[]): Portfolio {
  const computed = inputs.map((h) => {
    const total = dec(h.total);
    const held = min(dec(h.held), total);
    const inWallet = total - held;
    const locked = min(dec(h.locked), inWallet);
    const free = max(inWallet - locked, ZERO);
    const price = dec(h.priceUsd);
    const value = mul(total, price);
    const change = h.priceDayAgoUsd === null ? null : mul(total, price - dec(h.priceDayAgoUsd));
    return { h, held, locked, free, value, lockedValue: mul(locked, price), change };
  });

  const totalUsd = sum(computed.map((c) => c.value));
  const lockedUsd = sum(computed.map((c) => c.lockedValue));
  const change = sum(computed.map((c) => c.change ?? ZERO));

  const rows: PortfolioRow[] = computed
    .sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))
    .map((c) => ({
      ...c.h,
      heldQty: toDecimalString(c.held),
      lockedQty: toDecimalString(c.locked),
      freeQty: toDecimalString(c.free),
      valueUsd: toDecimalString(c.value),
      lockedUsd: toDecimalString(c.lockedValue),
      shareBps: bpsOf(c.value, totalUsd),
      change24hUsd: c.change === null ? null : toDecimalString(c.change),
    }));

  // Networks in order of value, keeping the first-seen order for ties.
  const chains = [...new Set(computed.map((c) => c.h.chain))];
  const byNetwork = chains
    .map((chain) => ({ chain, value: sum(computed.filter((c) => c.h.chain === chain).map((c) => c.value)) }))
    .sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))
    .map(({ chain, value }) => ({ chain, valueUsd: toDecimalString(value), bps: bpsOf(value, totalUsd) }));

  const dayAgo = totalUsd - change;
  return {
    rows,
    totalUsd: toDecimalString(totalUsd),
    lockedUsd: toDecimalString(lockedUsd),
    freeUsd: toDecimalString(totalUsd - lockedUsd),
    change24hUsd: toDecimalString(change),
    change24hBps: dayAgo > ZERO ? Number((change * 10_000n) / dayAgo) : 0,
    byNetwork,
  };
}
