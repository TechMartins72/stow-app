import "server-only";

import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { dec, mul, toDecimalString, ZERO } from "@/engine/decimal";
import { nextRelease, type Asset, type Engine, type GuardUser, type ProposedAction } from "@/engine";
import { cashFor, isInvestable, tradability } from "@/app/_lib/catalog-policy";
import { parseProfile, suggest, type RiskProfile, type Suggestion, type UpcomingRelease } from "@/app/_lib/advisor";
import { tickerOf } from "@/app/_lib/trade-policy";
import { getDb } from "./engine";
import { loadHoldings } from "./wallet";

export interface CheckedSuggestion extends Suggestion {
  /** The guard's answer if this were done now; null for suggestions that sign nothing. */
  check: { allowed: boolean; reason?: string } | null;
}

const g = globalThis as typeof globalThis & { __profiles?: Map<string, RiskProfile> };

export async function getProfile(userId: string): Promise<RiskProfile> {
  const db = getDb();
  if (!db) return (g.__profiles ??= new Map()).get(userId) ?? "balanced";
  const [row] = await db.select({ p: users.riskProfile }).from(users).where(eq(users.id, userId));
  return parseProfile(row?.p);
}

export async function setProfile(userId: string, profile: RiskProfile): Promise<void> {
  const db = getDb();
  if (!db) {
    (g.__profiles ??= new Map()).set(userId, profile);
    return;
  }
  await db.update(users).set({ riskProfile: profile }).where(eq(users.id, userId));
}

/** Everything the Advisor needs, and its suggestions, rebuilt from live data. */
export async function computeSuggestions(engine: Engine, user: GuardUser) {
  const [profile, holdings, catalog, locks] = await Promise.all([
    getProfile(user.id),
    loadHoldings(engine, user),
    engine.client.listAssets({ asset_class: "crypto,stock" }),
    engine.store.listLocks(user.id),
  ]);
  const now = new Date();
  const classOf = (id: string) => catalog.find((a) => a.id === id)?.asset_class;
  const advisorHoldings = holdings.map((h) => ({
    assetId: h.assetId,
    ticker: tickerOf({ symbol: h.symbol, chain: h.chain, asset_class: classOf(h.assetId) }),
    chain: h.chain,
    stable: h.stable,
    assetClass: classOf(h.assetId) === "stock" ? ("stock" as const) : ("crypto" as const),
    decimals: h.decimals,
    priceUsd: h.priceUsd,
    available: h.available,
    free: h.accessible,
  }));
  const stocks = catalog
    .filter((a) => a.asset_class === "stock" && isInvestable(a) && tradability(a) === "buy_sell")
    .map((a) => ({ assetId: a.id, ticker: tickerOf({ symbol: a.symbol, chain: a.chain, asset_class: a.asset_class }), chain: a.chain }))
    .sort((a, b) => (a.ticker === "AAPL" ? -1 : b.ticker === "AAPL" ? 1 : a.ticker.localeCompare(b.ticker)));
  const upcoming: UpcomingRelease[] = locks.flatMap((l) => {
    const next = nextRelease(l, now);
    return next ? [{ lockId: l.id, goalName: l.goalName ?? `${l.symbol} lock`, symbol: l.symbol, amount: next.amount, releaseAt: next.releaseAt }] : [];
  });
  const suggestions = suggest({ holdings: advisorHoldings, stocks, upcoming, profile, now });
  return { profile, suggestions, holdings, catalog };
}

/** Suggestions plus the guard's verdict on each, so the page can show "passes your rules". */
export async function loadAdvisor(engine: Engine, user: GuardUser) {
  const { profile, suggestions, holdings, catalog } = await computeSuggestions(engine, user);
  const checked: CheckedSuggestion[] = await Promise.all(
    suggestions.map(async (s) => {
      const action = proposed(s, holdings, catalog);
      if (!action) return { ...s, check: null };
      const decision = await engine.guard.preview(user, action);
      return { ...s, check: { allowed: decision.allowed, reason: decision.violations[0]?.message } };
    }),
  );
  const log = (await engine.store.listLog(user.id, 50)).filter((e) => e.actor === "advisor").slice(0, 10);
  const tickers: Record<string, string> = Object.fromEntries(
    catalog.map((a) => [a.symbol, tickerOf({ symbol: a.symbol, chain: a.chain, asset_class: a.asset_class })]),
  );
  return { profile, suggestions: checked, log, tickers };
}

function proposed(
  s: Suggestion,
  holdings: Awaited<ReturnType<typeof loadHoldings>>,
  catalog: Asset[],
): ProposedAction | null {
  if (s.action.kind === "sell") {
    const { assetId, qty } = s.action;
    const h = holdings.find((x) => x.assetId === assetId);
    if (!h) return null;
    return {
      kind: "sell",
      actor: "advisor",
      assetId,
      symbol: h.symbol,
      productType: "spot",
      debits: [{ assetId, symbol: h.symbol, qty }],
      notionalUsd: toDecimalString(mul(dec(qty), dec(h.priceUsd)), 6),
    };
  }
  if (s.action.kind === "buy") {
    const { assetId, amountUsd } = s.action;
    const asset = catalog.find((a) => a.id === assetId);
    const usdc = asset ? cashFor(catalog, asset.chain) : undefined;
    if (!asset || !usdc || dec(amountUsd) <= ZERO) return null;
    return {
      kind: "buy",
      actor: "advisor",
      assetId,
      symbol: asset.symbol,
      productType: "spot",
      debits: [{ assetId: usdc.id, symbol: usdc.symbol, qty: amountUsd }],
      notionalUsd: amountUsd,
    };
  }
  return null;
}
