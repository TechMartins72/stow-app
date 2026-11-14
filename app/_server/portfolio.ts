import "server-only";

import { dec, toDecimalString, ZERO } from "@/engine/decimal";
import { lockedNow, nextRelease, tranchesOf, type Asset, type Engine, type GuardUser } from "@/engine";
import { chainFamily, networkLabel } from "@/app/_lib/address";
import { cryptoLabel, isInvestable, summarisePoints, SUPPORTED_CHAINS, tradability } from "@/app/_lib/catalog-policy";
import { allocation, bucketOf, type AllocationSlice } from "@/app/_lib/home-summary";
import { portfolio, type Portfolio, type PortfolioInput, type PortfolioRow } from "@/app/_lib/portfolio";
import { displayName, tickerOf } from "@/app/_lib/trade-policy";
import { getCurrentUser } from "./current-user";
import { getEngine, retryReadIfDbStuck } from "./engine";
import { gatewayFailure, type GatewayFailure } from "./gateway-failure";
import { dayHistory, logoOf } from "./market";
import { priceMap } from "./wallet";

/** A savings goal or budget holding part of an asset right now. */
export interface PortfolioPlan {
  lockId: string;
  goalName: string;
  kind: "goal" | "budget";
  lockedQty: string;
  /** When the next part (or, for a goal, all of it) frees up. */
  nextAt: Date | null;
  nextQty: string | null;
}

export interface PortfolioHolding extends PortfolioRow {
  ticker: string;
  name: string;
  network: string;
  icon: string | null;
  /** 24-hour price move in percent, display only; null for cash or without market data. */
  change24hPct: { pct: number; direction: "up" | "down" | "flat" } | null;
  sparkline: string[];
  plans: PortfolioPlan[];
  /** Links that make sense for this asset. */
  investHref?: string;
  canBuy: boolean;
  canSell: boolean;
  canSend: boolean;
}

export interface PortfolioData extends Omit<Portfolio, "rows" | "byNetwork"> {
  mode: "mock" | "live";
  holdings: PortfolioHolding[];
  byBucket: AllocationSlice[];
  byNetwork: { label: string; valueUsd: string; bps: number }[];
}

export type PortfolioResult = { ok: true; data: PortfolioData } | GatewayFailure;

export async function loadPortfolio(): Promise<PortfolioResult> {
  try {
    // A read: if the database pool was stuck, try once more on a fresh one.
    const data = await retryReadIfDbStuck(async () => {
      const engine = getEngine();
      return build(engine, await getCurrentUser(engine));
    });
    return { ok: true, data };
  } catch (err) {
    return gatewayFailure(getEngine(), err);
  }
}

async function build(engine: Engine, user: GuardUser): Promise<PortfolioData> {
  const [balances, allLocks, catalog] = await Promise.all([
    engine.client.getBalances(user.gatewayUserId),
    engine.store.listLocks(user.id),
    engine.client.listAssets({ asset_class: "crypto,stock" }),
  ]);
  const now = new Date();
  const byId = new Map(catalog.map((a) => [a.id, a]));
  const held = balances.filter((b) => dec(b.total) > ZERO);
  const volatile = held.map((b) => byId.get(b.asset_id)).filter((a): a is Asset => Boolean(a) && !a!.stable);
  const [prices, history] = await Promise.all([priceMap(engine, user, held), dayHistory(engine, volatile)]);
  const locks = allLocks.filter((l) => lockedNow(l, now) > ZERO);

  const extras = new Map<string, Omit<PortfolioHolding, keyof PortfolioRow>>();
  const inputs: PortfolioInput[] = held.map((b) => {
    const asset = byId.get(b.asset_id);
    const decimals = b.decimals ?? asset?.decimals ?? 6;
    const price = prices.get(b.asset_id) ?? ZERO;
    const points = !b.stable && asset?.economic_asset_id ? (history.get(asset.economic_asset_id) ?? []) : [];
    const summary = summarisePoints(points);
    // Value uses the live quote price (as everywhere else); the 24h change is the market's
    // move over the day applied to it, so the two sources can't disagree.
    const move = summary && points.length > 1 ? dec(points.at(-1)!.price) - dec(points[0].price) : null;
    const priceDayAgo = move === null ? null : toDecimalString(price - move);

    const ticker = (() => {
      const t = tickerOf({ symbol: b.symbol, chain: b.chain, asset_class: asset?.asset_class });
      return t === "CBBTC" ? "BTC" : t;
    })();
    const assetLocks = locks.filter((l) => l.assetId === b.asset_id);
    const plans: PortfolioPlan[] = assetLocks
      .map((l) => {
        const next = nextRelease(l, now);
        return {
          lockId: l.id,
          goalName: l.goalName ?? `${ticker} plan`,
          kind: tranchesOf(l).length > 1 ? ("budget" as const) : ("goal" as const),
          lockedQty: toDecimalString(lockedNow(l, now), decimals),
          nextAt: next?.releaseAt ?? null,
          nextQty: next?.amount ?? null,
        };
      })
      .sort((x, y) => (x.nextAt?.getTime() ?? 0) - (y.nextAt?.getTime() ?? 0));

    const investable = asset ? isInvestable(asset) : false;
    const supported = (SUPPORTED_CHAINS as readonly string[]).includes(b.chain ?? "");
    extras.set(b.asset_id, {
      ticker,
      name: (asset && cryptoLabel(asset)) ?? displayName(b.name ?? asset?.name ?? b.symbol),
      network: networkLabel(b.chain),
      icon: asset ? logoOf(asset) : null,
      change24hPct: summary ? { pct: summary.changePct, direction: summary.direction } : null,
      sparkline: points.map((p) => p.price),
      plans,
      investHref: investable ? `/invest/${b.asset_id}` : undefined,
      canBuy: investable && asset !== undefined && tradability(asset) === "buy_sell",
      canSell: investable,
      // Crypto only for now (see app/withdraw/actions.ts); stocks stay inside True Markets.
      canSend: asset?.asset_class !== "stock" && supported && chainFamily(b.chain) !== null,
    });

    return {
      assetId: b.asset_id,
      symbol: b.symbol,
      chain: b.chain,
      bucket: bucketOf({ stable: b.stable, asset_class: asset?.asset_class }),
      decimals,
      total: b.total,
      held: b.held ?? "0",
      locked: toDecimalString(assetLocks.reduce((s, l) => s + lockedNow(l, now), ZERO)),
      priceUsd: toDecimalString(price),
      priceDayAgoUsd: priceDayAgo,
    };
  });

  const p = portfolio(inputs);
  return {
    mode: engine.config.mode,
    totalUsd: p.totalUsd,
    lockedUsd: p.lockedUsd,
    freeUsd: p.freeUsd,
    change24hUsd: p.change24hUsd,
    change24hBps: p.change24hBps,
    holdings: p.rows.map((r) => ({ ...r, ...extras.get(r.assetId)! })),
    byBucket: allocation(p.rows.map((r) => ({ bucket: r.bucket, valueUsd: r.valueUsd }))),
    byNetwork: p.byNetwork.map((n) => ({ label: networkLabel(n.chain), valueUsd: n.valueUsd, bps: n.bps })),
  };
}
