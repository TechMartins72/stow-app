import "server-only";

import { dec, min, mul, sum, toDecimalString, ZERO } from "@/engine/decimal";
import { accessibleBalance, lockedNow, nextRelease, tranchesOf, type Engine, type GuardUser } from "@/engine";
import { seedMockDemo } from "./demo-seed";
import { getCurrentUser, getEngine } from "./engine";
import { gatewayFailure, type GatewayFailure } from "./gateway-failure";
import { priceMap } from "./wallet";

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
  /** The whole lock, released and not. */
  amount: string;
  /** Still locked right now, and its value. */
  lockedAmount: string;
  lockedUsd: string;
  createdAt: Date;
  unlockAt: Date;
  /** Number of parts (1 for a one-date lock) and how many have freed themselves. */
  parts: number;
  partsReleased: number;
  /** Share of `amount` already released, 0..1. Display only. */
  releasedShare: number;
  next?: { releaseAt: Date; amount: string };
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
    locks: locks
      .map((l): HomeLock => {
        const parts = tranchesOf(l);
        const stillLocked = lockedNow(l, now);
        const total = dec(l.amount);
        const next = nextRelease(l, now);
        return {
          id: l.id,
          goalName: l.goalName ?? `${l.symbol} lock`,
          symbol: l.symbol,
          amount: l.amount,
          lockedAmount: toDecimalString(stillLocked),
          lockedUsd: toDecimalString(mul(stillLocked, priceOf(l.assetId)), 6),
          createdAt: l.createdAt,
          unlockAt: l.unlockAt,
          parts: parts.length,
          partsReleased: parts.filter((t) => t.releaseAt <= now).length,
          releasedShare: total > ZERO ? Number(((total - stillLocked) * 10_000n) / total) / 10_000 : 0,
          next: next ? { releaseAt: next.releaseAt, amount: next.amount } : undefined,
        };
      })
      .sort((a, b) => (a.next?.releaseAt ?? a.unlockAt).getTime() - (b.next?.releaseAt ?? b.unlockAt).getTime()),
  };
}
