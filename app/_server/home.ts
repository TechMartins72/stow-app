import "server-only";

import { dec, min, mul, sum, toDecimalString, ZERO } from "@/engine/decimal";
import { accessibleBalance, lockedNow, type Engine, type GuardUser } from "@/engine";
import { sortLockViews, toLockView, type LockView } from "@/app/_lib/lock-view";
import { seedMockDemo } from "./demo-seed";
import { getCurrentUser } from "./current-user";
import { getEngine } from "./engine";
import { gatewayFailure, type GatewayFailure } from "./gateway-failure";
import { priceMap } from "./wallet";

export interface HomeHolding {
  assetId: string;
  symbol: string;
  name: string;
  qty: string;
  valueUsd: string;
}

export type HomeLock = LockView;

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

export type HomeResult = { ok: true; data: HomeData } | GatewayFailure;

/** Everything Home needs, in one call. Expected failures come back as values, not throws. */
export async function loadHome(): Promise<HomeResult> {
  const engine = getEngine();
  try {
    const user = await getCurrentUser(engine);
    await seedMockDemo(engine, user);
    return { ok: true, data: await build(engine, user) };
  } catch (err) {
    return gatewayFailure(engine, err);
  }
}

async function build(engine: Engine, user: GuardUser): Promise<HomeData> {
  const [balances, allLocks] = await Promise.all([
    engine.client.getBalances(user.gatewayUserId),
    engine.store.listLocks(user.id),
  ]);
  const now = new Date();
  // Locks whose every part has freed itself drop off Home.
  const locks = allLocks.filter((l) => lockedNow(l, now) > ZERO);
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
      const { available, locked } = accessibleBalance(assetId, { balances, locks, now });
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
    locks: sortLockViews(locks.map((l) => toLockView(l, now, priceOf(l.assetId)))).active,
  };
}
