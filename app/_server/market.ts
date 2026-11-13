import "server-only";

import { dec, mul, toDecimalString, ZERO } from "@/engine/decimal";
import type { Asset, Candle, Engine, GuardUser } from "@/engine";
import { cashFor, cryptoLabel, isInvestable, summarisePoints, tradability, type Tradability } from "@/app/_lib/catalog-policy";
import { CHART_RANGES, type ChartRange } from "@/app/_lib/chart-ranges";
import { displayName, tickerOf } from "@/app/_lib/trade-policy";
import { loadHoldings, type Holding } from "./wallet";

export interface MarketAsset {
  assetId: string;
  /** For the public market-data endpoints. */
  economicId: string | null;
  symbol: string;
  ticker: string;
  name: string;
  chain: string | null;
  assetClass: "stock" | "crypto";
  decimals: number;
  icon: string | null;
  tradability: Tradability;
  /** Latest market price; null when market data had none. */
  priceUsd: string | null;
  /** 24-hour change in percent (display only) and its direction. */
  change24h: { pct: number; direction: "up" | "down" | "flat" } | null;
  /** Hourly prices over the last day, oldest first, for the sparkline. */
  sparkline: string[];
  owned: string;
  locked: string;
  free: string;
  valueUsd: string;
}

export interface MarketAssetDetail extends MarketAsset {
  description: string | null;
  website: string | null;
}

export interface PayingWith {
  assetId: string;
  symbol: string;
  chain: string | null;
  free: string;
}

export interface ChartData {
  range: ChartRange;
  candles: Candle[];
}

/** Stocks people look for first; the rest follow alphabetically. */
const POPULAR = ["AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "TSLA"];

async function catalog(engine: Engine) {
  const all = await engine.client.listAssets({ asset_class: "crypto,stock" });
  return { all, investable: all.filter(isInvestable) };
}

/** Last-day price history for many assets in one public call. Never fails the page. */
export async function dayHistory(engine: Engine, assets: Asset[]) {
  const ids = assets.map((a) => a.economic_asset_id).filter((id): id is string => Boolean(id));
  try {
    const series = await engine.client.priceHistoryBatch(ids, "1d", "1h");
    return new Map(series.map((s) => [s.asset_id, s.points]));
  } catch {
    return new Map<string, { t: string; price: string }[]>();
  }
}

/**
 * A crisp logo: the catalog's `icon` is a tiny (~25px) thumbnail, so prefer
 * `image.large`, or the same CoinGecko path at its large size.
 */
export function logoOf(a: Asset): string | null {
  const large = (a.image as { large?: unknown } | undefined)?.large;
  if (typeof large === "string" && large.startsWith("https://")) return large;
  if (typeof a.icon !== "string" || !a.icon.startsWith("https://")) return null;
  return a.icon.includes("coin-images.coingecko.com") ? a.icon.replace("/small/", "/large/") : a.icon;
}

export function toMarketAsset(a: Asset, holding: Holding | undefined, points: { price: string }[] | undefined): MarketAsset {
  const summary = summarisePoints(points ?? []);
  const owned = holding?.available ?? "0";
  // Market data first; a held asset can fall back to the wallet's quote-based price.
  const price = summary?.price ?? (holding && dec(holding.priceUsd) > ZERO ? holding.priceUsd : null);
  const ticker = tickerOf({ symbol: a.symbol, chain: a.chain, asset_class: a.asset_class });
  return {
    assetId: a.id,
    economicId: a.economic_asset_id ?? null,
    symbol: a.symbol,
    ticker: ticker === "CBBTC" ? "BTC" : ticker,
    name: cryptoLabel(a) ?? displayName(a.name ?? a.symbol),
    chain: a.chain,
    assetClass: a.asset_class === "stock" ? "stock" : "crypto",
    decimals: a.decimals ?? 8,
    icon: logoOf(a),
    tradability: tradability(a) ?? "sell_only",
    priceUsd: price,
    change24h: summary ? { pct: summary.changePct, direction: summary.direction } : null,
    sparkline: (points ?? []).map((p) => p.price),
    owned,
    locked: holding?.locked ?? "0",
    free: holding?.accessible ?? "0",
    valueUsd: price ? toDecimalString(mul(dec(owned), dec(price)), 6) : "0",
  };
}

export async function loadMarket(engine: Engine, user: GuardUser): Promise<MarketAsset[]> {
  const [{ investable }, holdings] = await Promise.all([catalog(engine), loadHoldings(engine, user)]);
  const history = await dayHistory(engine, investable);
  const assets = investable.map((a) =>
    toMarketAsset(a, holdings.find((h) => h.assetId === a.id), a.economic_asset_id ? history.get(a.economic_asset_id) : undefined),
  );
  const rank = (m: MarketAsset) => {
    const p = POPULAR.indexOf(m.ticker);
    return p === -1 ? 99 : p;
  };
  return assets.sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name));
}

/** One asset with its position, the cash that pays for it, and the first chart. */
export async function loadMarketAsset(
  engine: Engine,
  user: GuardUser,
  assetId: string,
  opts: { chart?: boolean } = {},
): Promise<{ asset: MarketAssetDetail; paying: PayingWith | null; raw: Asset; chart: ChartData | null } | null> {
  const [{ all, investable }, holdings] = await Promise.all([catalog(engine), loadHoldings(engine, user)]);
  const raw = investable.find((a) => a.id === assetId);
  if (!raw) return null;
  const [history, chart] = await Promise.all([dayHistory(engine, [raw]), opts.chart === false ? null : loadChart(engine, raw, "1D")]);
  const asset = toMarketAsset(raw, holdings.find((h) => h.assetId === raw.id), raw.economic_asset_id ? history.get(raw.economic_asset_id) : undefined);
  const cash = cashFor(all, raw.chain);
  const cashHolding = cash ? holdings.find((h) => h.assetId === cash.id) : undefined;
  return {
    asset: {
      ...asset,
      description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : null,
      website: typeof raw.website === "string" && raw.website.startsWith("https://") ? raw.website : null,
    },
    paying: cash ? { assetId: cash.id, symbol: cash.symbol, chain: cash.chain, free: cashHolding?.accessible ?? "0" } : null,
    raw,
    chart,
  };
}

/** Candles for one of the chart ranges. Null when market data has none for this asset. */
export async function loadChart(engine: Engine, asset: Pick<Asset, "economic_asset_id">, range: ChartRange): Promise<ChartData | null> {
  const id = asset.economic_asset_id;
  const spec = CHART_RANGES.find((r) => r.value === range);
  if (!id || !spec) return null;
  try {
    const series = await engine.client.candles(id, spec.window, spec.resolution);
    return series.candles?.length ? { range, candles: series.candles } : null;
  } catch {
    return null;
  }
}

/** Every investable asset by id, for actions that only need the catalog entry. */
export async function findInvestable(engine: Engine, assetId: string): Promise<Asset | undefined> {
  return (await catalog(engine)).investable.find((a) => a.id === assetId);
}
