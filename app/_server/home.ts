import "server-only";

import { dec, min, mul, sum, toDecimalString, ZERO } from "@/engine/decimal";
import { accessibleBalance, lockedNow, type Asset, type Engine, type GuardUser } from "@/engine";
import { buildActivity, type ActivityItem } from "@/app/_lib/activity";
import { networkLabel } from "@/app/_lib/address";
import { cryptoLabel, isInvestable, summarisePoints } from "@/app/_lib/catalog-policy";
import { allocation, bucketOf, upcomingReleases, type AllocationSlice, type Bucket, type UpcomingRelease } from "@/app/_lib/home-summary";
import { sortLockViews, toLockView, type LockView } from "@/app/_lib/lock-view";
import { displayName, tickerOf } from "@/app/_lib/trade-policy";
import { seedMockDemo } from "./demo-seed";
import { getCurrentUser } from "./current-user";
import { getEngine, retryReadIfDbStuck } from "./engine";
import { gatewayFailure, type GatewayFailure } from "./gateway-failure";
import { getAdvisorEnabled } from "./advisor";
import { dayHistory, logoOf, toMarketAsset, type MarketAsset } from "./market";
import { priceMap } from "./wallet";

export interface HomeHolding {
  assetId: string;
  ticker: string;
  name: string;
  network: string;
  bucket: Bucket;
  icon: string | null;
  decimals: number;
  qty: string;
  /** Held by locks right now (capped at what the wallet holds). */
  lockedQty: string;
  valueUsd: string;
  /** 24-hour change, display only. Null for cash or when market data has none. */
  change24h: { pct: number; direction: "up" | "down" | "flat" } | null;
  /** The asset's Invest page, when it's on the Invest list. */
  href?: string;
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
  allocation: AllocationSlice[];
  locks: HomeLock[];
  /** Active locks by kind: one date (a savings goal) or released in parts (a budget). */
  vault: { goals: number; budgets: number };
  /** Biggest 24-hour price moves on the Invest list. */
  movers: MarketAsset[];
  advisorEnabled: boolean;
  upcoming: (UpcomingRelease & { ticker: string })[];
  /** Latest few items; null when the history couldn't be loaded (Home still shows). */
  activity: ActivityItem[] | null;
}

export type HomeResult = { ok: true; data: HomeData } | GatewayFailure;

/** Everything Home needs, in one call. Expected failures come back as values, not throws. */
export async function loadHome(): Promise<HomeResult> {
  try {
    // A read: if the database pool was stuck, try once more on a fresh one (getEngine() inside picks it up).
    const data = await retryReadIfDbStuck(async () => {
      const engine = getEngine();
      const user = await getCurrentUser(engine);
      await seedMockDemo(engine, user); // practice mode only; checks before it writes
      return build(engine, user);
    });
    return { ok: true, data };
  } catch (err) {
    return gatewayFailure(getEngine(), err);
  }
}

const ACTIVITY_ON_HOME = 5;
const UPCOMING_ON_HOME = 4;
const MOVERS_ON_HOME = 4;

async function build(engine: Engine, user: GuardUser): Promise<HomeData> {
  // Everything that doesn't depend on anything else, in parallel. History is a
  // nice-to-have on Home, so its failure doesn't take the page down.
  const [balances, allLocks, catalog, transactions, log, advisorEnabled] = await Promise.all([
    engine.client.getBalances(user.gatewayUserId),
    engine.store.listLocks(user.id),
    engine.client.listAssets({ asset_class: "crypto,stock" }),
    engine.client.listTransactions(user.gatewayUserId, { limit: 20 }).then((p) => p.data).catch(() => null),
    engine.store.listLog(user.id, 20),
    getAdvisorEnabled(user.id),
  ]);
  const now = new Date();
  const byId = new Map(catalog.map((a) => [a.id, a]));
  const held = balances.filter((b) => dec(b.total) > ZERO);
  const investable = catalog.filter(isInvestable);
  // One market-data call covers both the Invest list (for movers) and anything held.
  const heldVolatile = held.map((b) => byId.get(b.asset_id)).filter((a): a is Asset => Boolean(a) && !a!.stable);
  const [prices, history] = await Promise.all([
    priceMap(engine, user, held),
    dayHistory(engine, [...new Map([...investable, ...heldVolatile].map((a) => [a.id, a])).values()]),
  ]);
  const priceOf = (assetId: string) => prices.get(assetId) ?? ZERO;

  // Locks whose every part has freed itself drop off Home.
  const locks = allLocks.filter((l) => lockedNow(l, now) > ZERO);
  const tickerFor = (a: Pick<Asset, "symbol" | "chain" | "asset_class">) => {
    const t = tickerOf({ symbol: a.symbol, chain: a.chain, asset_class: a.asset_class });
    return t === "CBBTC" ? "BTC" : t;
  };

  const holdings: HomeHolding[] = held
    .map((b) => {
      const asset = byId.get(b.asset_id);
      const info = asset ?? { symbol: b.symbol, chain: b.chain, asset_class: undefined, stable: b.stable, name: b.name };
      const { available, locked } = accessibleBalance(b.asset_id, { balances, locks, now });
      const points = asset?.economic_asset_id ? history.get(asset.economic_asset_id) : undefined;
      const summary = b.stable ? null : summarisePoints(points ?? []);
      const decimals = b.decimals ?? asset?.decimals ?? 6;
      return {
        assetId: b.asset_id,
        ticker: tickerFor(info),
        name: (asset && cryptoLabel(asset)) ?? displayName(b.name ?? asset?.name ?? b.symbol),
        network: networkLabel(b.chain),
        bucket: bucketOf({ stable: b.stable, asset_class: asset?.asset_class }),
        icon: asset ? logoOf(asset) : null,
        decimals,
        qty: b.total,
        lockedQty: toDecimalString(min(locked, available), decimals),
        valueUsd: toDecimalString(mul(dec(b.total), priceOf(b.asset_id)), 6),
        change24h: summary ? { pct: summary.changePct, direction: summary.direction } : null,
        href: asset && isInvestable(asset) ? `/invest/${asset.id}` : undefined,
      };
    })
    .sort((x, y) => (dec(y.valueUsd) > dec(x.valueUsd) ? 1 : dec(y.valueUsd) < dec(x.valueUsd) ? -1 : 0));

  // Locked value per asset is capped at what the wallet actually holds.
  const lockedByAsset = new Set(locks.map((l) => l.assetId));
  const lockedUsd = sum(
    [...lockedByAsset].map((assetId) => {
      const { available, locked } = accessibleBalance(assetId, { balances, locks, now });
      return mul(min(available, locked), priceOf(assetId));
    }),
  );
  const totalUsd = sum(holdings.map((h) => dec(h.valueUsd)));

  const tickers = Object.fromEntries(catalog.map((a) => [a.symbol, tickerFor(a)]));
  const tickerOfSymbol = (symbol: string) => tickers[symbol] ?? symbol;

  return {
    mode: engine.config.mode,
    totalUsd: toDecimalString(totalUsd, 6),
    lockedUsd: toDecimalString(lockedUsd, 6),
    accessibleUsd: toDecimalString(totalUsd - lockedUsd, 6),
    // A ratio, not an amount: safe to hand to the UI as a small integer.
    lockedBps: totalUsd > ZERO ? Number((lockedUsd * 10_000n) / totalUsd) : 0,
    holdings,
    allocation: allocation(holdings),
    locks: sortLockViews(locks.map((l) => toLockView(l, now, priceOf(l.assetId)))).active,
    vault: {
      goals: locks.filter((l) => !l.schedule || l.schedule.length <= 1).length,
      budgets: locks.filter((l) => (l.schedule?.length ?? 0) > 1).length,
    },
    movers: investable
      .map((a) => toMarketAsset(a, undefined, a.economic_asset_id ? history.get(a.economic_asset_id) : undefined))
      .filter((m) => m.change24h && m.change24h.direction !== "flat")
      .sort((x, y) => Math.abs(y.change24h!.pct) - Math.abs(x.change24h!.pct))
      .slice(0, MOVERS_ON_HOME),
    advisorEnabled,
    upcoming: upcomingReleases(locks, now, UPCOMING_ON_HOME).map((r) => ({ ...r, ticker: tickerOfSymbol(r.symbol) })),
    activity: transactions
      ? buildActivity({ transactions, log, locks: allLocks, now, tickers }).slice(0, ACTIVITY_ON_HOME)
      : null,
  };
}
