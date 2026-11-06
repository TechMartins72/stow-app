// The Advisor: a few clear, explainable suggestions computed from the user's
// holdings, locks and risk profile. Pure and deterministic, so the server can
// rebuild exactly the suggestion the user approved instead of trusting the
// browser. Anything it proposes still goes through the SigningGuard as the
// "advisor" actor, under the same locks and limits as the user.

import { dec, div, min, mul, sum, toDecimalString, ZERO } from "@/engine/decimal";
import { formatDate, formatQty, formatUsd } from "./format";
import { MIN_ORDER_USD } from "./trade-policy";

export type RiskProfile = "careful" | "balanced" | "growth";

export const PROFILES: { value: RiskProfile; label: string; maxVolatilePct: number; blurb: string }[] = [
  { value: "careful", label: "Careful", maxVolatilePct: 30, blurb: "Mostly dollars. At most 30% in assets whose price swings." },
  { value: "balanced", label: "Balanced", maxVolatilePct: 50, blurb: "Half and half. At most 50% in stocks and crypto." },
  { value: "growth", label: "Growth", maxVolatilePct: 70, blurb: "More upside, more swings. Up to 70% in stocks and crypto." },
];

export const parseProfile = (v: string | null | undefined): RiskProfile =>
  v === "careful" || v === "growth" ? v : "balanced";

export interface AdvisorHolding {
  assetId: string;
  ticker: string;
  chain: string | null;
  stable: boolean;
  assetClass: "stock" | "crypto";
  decimals: number;
  priceUsd: string;
  /** In the wallet. */
  available: string;
  /** Not locked. */
  free: string;
}

export interface AdvisorStock {
  assetId: string;
  ticker: string;
  chain: string | null;
}

export interface UpcomingRelease {
  lockId: string;
  goalName: string;
  symbol: string;
  amount: string;
  releaseAt: Date;
}

export type SuggestionAction =
  | { kind: "sell"; assetId: string; qty: string }
  | { kind: "buy"; assetId: string; amountUsd: string }
  | { kind: "lock"; assetId: string; amount: string; days: number }
  | { kind: "link"; href: string; label: string };

export interface Suggestion {
  /** Stable for the same situation, so a dismissal or approval refers to one thing. */
  id: string;
  title: string;
  why: string;
  impact: string;
  action: SuggestionAction;
}

const pct = (part: bigint, whole: bigint) => (whole > ZERO ? Number((part * 1000n) / whole) / 10 : 0);
const truncate = (v: bigint, decimals: number) => dec(toDecimalString(v, decimals));
const SEVEN_DAYS = 7 * 86_400_000;

export function suggest(input: {
  holdings: AdvisorHolding[];
  stocks: AdvisorStock[];
  upcoming: UpcomingRelease[];
  profile: RiskProfile;
  now: Date;
}): Suggestion[] {
  const { holdings, stocks, upcoming, profile, now } = input;
  const target = PROFILES.find((p) => p.value === profile)!;
  const value = (h: AdvisorHolding, qty = h.available) => mul(dec(qty), dec(h.priceUsd));
  const total = sum(holdings.map((h) => value(h)));
  const volatile = holdings.filter((h) => !h.stable);
  const volatileUsd = sum(volatile.map((h) => value(h)));
  const out: Suggestion[] = [];

  // 1. Too much in things whose price swings: sell some of the biggest free volatile holding.
  const cap = (total * BigInt(target.maxVolatilePct)) / 100n;
  const slack = (total * 5n) / 100n; // don't nag over a few percent
  if (total > ZERO && volatileUsd > cap + slack) {
    const biggest = [...volatile].sort((a, b) => (value(b, b.free) > value(a, a.free) ? 1 : -1))[0];
    if (biggest && dec(biggest.free) > ZERO && dec(biggest.priceUsd) > ZERO) {
      const excessUsd = volatileUsd - cap;
      const qty = truncate(min(dec(biggest.free), div(excessUsd, dec(biggest.priceUsd))), Math.min(biggest.decimals, 6));
      const proceeds = mul(qty, dec(biggest.priceUsd));
      if (proceeds >= dec(MIN_ORDER_USD)) {
        const after = pct(volatileUsd - proceeds, total);
        out.push({
          id: `reduce-risk:${biggest.assetId}:${profile}`,
          title: `Sell ${formatQty(toDecimalString(qty), 6)} ${biggest.ticker} for USDC`,
          why: `${pct(volatileUsd, total)}% of your savings is in assets whose price swings. Your ${target.label} profile aims for at most ${target.maxVolatilePct}%.`,
          impact: `Swinging share ${pct(volatileUsd, total)}% → ${after}%. About ${formatUsd(toDecimalString(proceeds, 2))} moves into USDC.`,
          action: { kind: "sell", assetId: biggest.assetId, qty: toDecimalString(qty) },
        });
      }
    }
  }

  // 2. A lot of free cash: lock half of it for 90 days.
  const freeCash = holdings.filter((h) => h.stable).sort((a, b) => (dec(b.free) > dec(a.free) ? 1 : -1))[0];
  if (freeCash && dec(freeCash.free) >= dec("100")) {
    const half = toDecimalString(dec(freeCash.free) / 2n, 0); // whole dollars
    out.push({
      id: `lock-idle:${freeCash.assetId}`,
      title: `Lock ${formatUsd(half)} for 3 months`,
      why: `${formatUsd(freeCash.free)} of ${freeCash.ticker} is free to spend right now. Locking half keeps it safe from impulse spending.`,
      impact: `Moves nothing. The app just won't sign it away until ${formatDate(new Date(now.getTime() + 90 * 86_400_000))}.`,
      action: { kind: "lock", assetId: freeCash.assetId, amount: half, days: 90 },
    });
  }

  // 3. No stocks yet: a small first buy, paid with free USDC on the stock's network.
  const ownsStock = holdings.some((h) => h.assetClass === "stock" && dec(h.available) > ZERO);
  if (!ownsStock && profile !== "careful") {
    for (const s of stocks) {
      const usdc = holdings.find((h) => h.stable && h.chain === s.chain && dec(h.free) >= dec("25"));
      if (!usdc) continue;
      out.push({
        id: `first-stock:${s.assetId}`,
        title: `Buy $10 of ${s.ticker}`,
        why: "You don't own any stocks yet. Starting small is a gentle way to begin investing.",
        impact: `Spends $10 of your free USDC. You can lock the shares afterwards.`,
        action: { kind: "buy", assetId: s.assetId, amountUsd: "10" },
      });
      break;
    }
  }

  // 4. Money unlocking soon: a nudge to keep some of it locked.
  const soon = upcoming
    .filter((u) => u.releaseAt > now && u.releaseAt.getTime() - now.getTime() <= SEVEN_DAYS)
    .sort((a, b) => a.releaseAt.getTime() - b.releaseAt.getTime())[0];
  if (soon) {
    out.push({
      id: `upcoming:${soon.lockId}:${soon.releaseAt.toISOString()}`,
      title: `${formatQty(soon.amount, 6)} ${soon.symbol} unlocks on ${formatDate(soon.releaseAt)}`,
      why: `Part of “${soon.goalName}” is about to become spendable.`,
      impact: "If you don't need it yet, lock some of it again.",
      action: { kind: "link", href: "/vault/new", label: "New lock" },
    });
  }

  return out;
}
