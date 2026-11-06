import "server-only";

import { dec, mul, toDecimalString, ZERO } from "@/engine/decimal";
import type { Asset, Engine, GuardUser } from "@/engine";
import { displayName, tickerOf } from "@/app/_lib/trade-policy";
import { loadHoldings, type Holding } from "./wallet";

export interface MarketAsset {
  assetId: string;
  symbol: string;
  ticker: string;
  name: string;
  chain: string | null;
  assetClass: "stock" | "crypto";
  decimals: number;
  /** Null when no quote could be had (or it wasn't fetched to keep the list fast). */
  priceUsd: string | null;
  owned: string;
  locked: string;
  free: string;
  valueUsd: string;
}

export interface PayingWith {
  assetId: string;
  symbol: string;
  chain: string | null;
  free: string;
}

/** Stocks people will look for first; everything else follows alphabetically. */
const POPULAR = ["AAPL", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "SPY"];
/** Live catalogs can list hundreds of stocks; only this many get a price on the list page. */
const PRICED_ON_LIST = 16;

async function priceOf(engine: Engine, user: GuardUser, assetId: string): Promise<string | null> {
  try {
    const q = await engine.client.quote(user.gatewayUserId, { asset_id: assetId, side: "sell", qty: "1", qty_unit: "base" });
    return dec(q.notional) > ZERO ? q.notional : null;
  } catch {
    return null;
  }
}

function toMarketAsset(a: Asset, holding: Holding | undefined, price: string | null): MarketAsset {
  const decimals = a.decimals ?? 8;
  const owned = holding?.available ?? "0";
  return {
    assetId: a.id,
    symbol: a.symbol,
    ticker: tickerOf({ symbol: a.symbol, chain: a.chain, asset_class: a.asset_class }),
    name: displayName(a.name ?? a.symbol),
    chain: a.chain,
    assetClass: a.asset_class === "stock" ? "stock" : "crypto",
    decimals,
    priceUsd: price,
    owned,
    locked: holding?.locked ?? "0",
    free: holding?.accessible ?? "0",
    valueUsd: price ? toDecimalString(mul(dec(owned), dec(price)), 6) : "0",
  };
}

/** Tradeable stocks and volatile crypto (stablecoins are the cash, not the investment). */
async function tradeableAssets(engine: Engine): Promise<Asset[]> {
  const all = await engine.client.listAssets({ asset_class: "crypto,stock" });
  return all.filter((a) => a.type !== "perp" && !a.stable && a.chain);
}

export async function loadMarket(engine: Engine, user: GuardUser): Promise<MarketAsset[]> {
  const [assets, holdings] = await Promise.all([tradeableAssets(engine), loadHoldings(engine, user)]);
  const held = (id: string) => holdings.find((h) => h.assetId === id);
  const rank = (a: Asset) => {
    const t = tickerOf({ symbol: a.symbol, chain: a.chain, asset_class: a.asset_class });
    const owned = held(a.id) ? 0 : 1;
    const popular = POPULAR.indexOf(t);
    return [owned, popular === -1 ? 99 : popular, t] as const;
  };
  const sorted = [...assets].sort((x, y) => {
    const [a1, a2, a3] = rank(x);
    const [b1, b2, b3] = rank(y);
    return a1 - b1 || a2 - b2 || a3.localeCompare(b3);
  });
  const prices = await Promise.all(sorted.map((a, i) => (i < PRICED_ON_LIST ? priceOf(engine, user, a.id) : Promise.resolve(null))));
  return sorted.map((a, i) => toMarketAsset(a, held(a.id), prices[i]));
}

/** One asset, its price, the user's position, and the USDC that pays for it (on the asset's own network). */
export async function loadMarketAsset(
  engine: Engine,
  user: GuardUser,
  assetId: string,
): Promise<{ asset: MarketAsset; paying: PayingWith | null; raw: Asset } | null> {
  const [assets, holdings, catalog] = await Promise.all([
    tradeableAssets(engine),
    loadHoldings(engine, user),
    engine.client.listAssets({ asset_class: "crypto" }),
  ]);
  const raw = assets.find((a) => a.id === assetId);
  if (!raw) return null;
  const price = await priceOf(engine, user, raw.id);
  const usdc = catalog.find((a) => a.symbol === "USDC" && a.chain === raw.chain);
  const usdcHolding = usdc ? holdings.find((h) => h.assetId === usdc.id) : undefined;
  return {
    asset: toMarketAsset(raw, holdings.find((h) => h.assetId === raw.id), price),
    paying: usdc ? { assetId: usdc.id, symbol: "USDC", chain: usdc.chain, free: usdcHolding?.accessible ?? "0" } : null,
    raw,
  };
}
