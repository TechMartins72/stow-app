import "server-only";

import { dec, min, mul, sum, toDecimalString, ZERO, type Dec } from "@/engine/decimal";
import { accessibleBalance, isGatewayError, type BalanceItem, type Engine, type GuardUser } from "@/engine";
import { seedMockDemo } from "./demo-seed";
import { getCurrentUser, getEngine } from "./engine";

export interface HomeHolding {
  assetId: string;
  symbol: string;
  name: string;
  qty: string;
  valueUsd: string;
}

export interface HomeLock {
  id: string;
  goalName: string;
  symbol: string;
  amount: string;
  valueUsd: string;
  createdAt: Date;
  unlockAt: Date;
}

export interface HomeData {
  mode: "mock" | "live";
  totalUsd: string;
  lockedUsd: string;
  accessibleUsd: string;
  /** Locked share of total value in basis points (0..10000). Display only. */
  lockedBps: number;
  holdings: HomeHolding[];
  locks: HomeLock[];
}

export type HomeResult =
  | { ok: true; data: HomeData }
  | { ok: false; reason: "gateway_unreachable" | "gateway_error"; mode: "mock" | "live"; requestId?: string };

/** Everything Home needs, in one call. Expected failures come back as values, not throws. */
export async function loadHome(): Promise<HomeResult> {
  const engine = getEngine();
  try {
    const user = await getCurrentUser(engine);
    await seedMockDemo(engine, user);
    return { ok: true, data: await build(engine, user) };
  } catch (err) {
    if (isGatewayError(err)) {
      return { ok: false, reason: "gateway_error", mode: engine.config.mode, requestId: err.requestId };
    }
    const code = (err as { cause?: { code?: string } })?.cause?.code;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
      return { ok: false, reason: "gateway_unreachable", mode: engine.config.mode };
    }
    throw err;
  }
}

async function build(engine: Engine, user: GuardUser): Promise<HomeData> {
  const [balances, allLocks] = await Promise.all([
    engine.client.getBalances(user.gatewayUserId),
    engine.store.listLocks(user.id),
  ]);
  const locks = allLocks.filter((l) => l.status === "active");
  const prices = await priceMap(engine, user, balances);
  const priceOf = (assetId: string) => prices.get(assetId) ?? ZERO;

  const holdings: HomeHolding[] = balances
    .filter((b) => dec(b.total) > ZERO)
    .map((b) => ({
      assetId: b.asset_id,
      symbol: b.symbol,
      name: b.name ?? b.symbol,
      qty: b.total,
      valueUsd: toDecimalString(mul(dec(b.total), priceOf(b.asset_id)), 6),
    }));

  // Locked value per asset is capped at what the wallet actually holds.
  const lockedByAsset = new Set(locks.map((l) => l.assetId));
  const lockedUsd = sum(
    [...lockedByAsset].map((assetId) => {
      const { available, locked } = accessibleBalance(assetId, { balances, locks });
      return mul(min(available, locked), priceOf(assetId));
    }),
  );
  const totalUsd = sum(holdings.map((h) => dec(h.valueUsd)));

  return {
    mode: engine.config.mode,
    totalUsd: toDecimalString(totalUsd, 6),
    lockedUsd: toDecimalString(lockedUsd, 6),
    accessibleUsd: toDecimalString(totalUsd - lockedUsd, 6),
    // A ratio, not an amount: safe to hand to the UI as a small integer.
    lockedBps: totalUsd > ZERO ? Number((lockedUsd * 10_000n) / totalUsd) : 0,
    holdings,
    locks: locks
      .map((l) => ({
        id: l.id,
        goalName: l.goalName ?? `${l.symbol} lock`,
        symbol: l.symbol,
        amount: l.amount,
        valueUsd: toDecimalString(mul(dec(l.amount), priceOf(l.assetId)), 6),
        createdAt: l.createdAt,
        unlockAt: l.unlockAt,
      }))
      .sort((a, b) => a.unlockAt.getTime() - b.unlockAt.getTime()),
  };
}

/** USD price per asset: stablecoins are 1, everything else from a sell quote for one unit. */
async function priceMap(engine: Engine, user: GuardUser, balances: BalanceItem[]): Promise<Map<string, Dec>> {
  const entries = await Promise.all(
    balances.map(async (b): Promise<[string, Dec]> => {
      if (b.stable) return [b.asset_id, dec("1")];
      const quote = await engine.client.quote(user.gatewayUserId, { asset_id: b.asset_id, side: "sell", qty: "1", qty_unit: "base" });
      return [b.asset_id, dec(quote.notional)];
    }),
  );
  return new Map(entries);
}
