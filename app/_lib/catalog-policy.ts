// Which catalog assets the Invest tab offers, and what pays for them.
// The live catalog has ~340 spot assets, mostly meme coins and stocks on
// networks we don't support end to end yet. A savings app shows a short,
// deliberate list: tokenized stocks on supported networks, plus a few
// approved cryptocurrencies.

import { dec, ZERO } from "@/engine/decimal";
import type { Asset } from "@/engine/gateway/types";

/** Networks with deposits, withdrawals and a cash stablecoin all working in the app. */
export const SUPPORTED_CHAINS = ["solana", "base"] as const;

/** Crypto worth offering in a savings app. Everything else (meme coins etc.) stays hidden. */
export const APPROVED_CRYPTO: { symbol: string; chain: string; label?: string }[] = [
  { symbol: "SOL", chain: "solana" },
  { symbol: "ETH", chain: "base" },
  { symbol: "CBBTC", chain: "base", label: "Bitcoin" },
];

export type Tradability = "buy_sell" | "sell_only";

/** Null when the asset can't be traded at all right now. */
export function tradability(a: Pick<Asset, "tradeable" | "is_active" | "status">): Tradability | null {
  if (a.tradeable === false || a.is_active === false) return null;
  if (a.status === "sell_only") return "sell_only";
  if (a.status === undefined || a.status === "active") return "buy_sell";
  return null;
}

const supported = (chain: string | null) => (SUPPORTED_CHAINS as readonly string[]).includes(chain ?? "");

/** Shown on the Invest tab: stocks on supported networks and approved crypto, if tradeable. */
export function isInvestable(a: Asset): boolean {
  if (a.type === "perp" || a.stable || a.venue === "cefi" || !supported(a.chain)) return false;
  if (tradability(a) === null) return false;
  if (a.asset_class === "stock") return true;
  return APPROVED_CRYPTO.some((c) => c.symbol === a.symbol.toUpperCase() && c.chain === a.chain);
}

/** A friendlier label for approved crypto (cbBTC reads as "Bitcoin"), else the catalog name. */
export function cryptoLabel(a: Pick<Asset, "symbol" | "chain" | "name">): string | undefined {
  return APPROVED_CRYPTO.find((c) => c.symbol === a.symbol.toUpperCase() && c.chain === a.chain)?.label;
}

/**
 * The stablecoin that pays for (and receives) trades on a network. USDC first; else any stable.
 * Not gated on `tradeable`: the live catalog marks every stablecoin tradeable: false, because you
 * pay with USDC rather than buy it. Only a stablecoin that's switched off doesn't count.
 */
export function cashFor(catalog: Asset[], chain: string | null): Asset | undefined {
  const stables = catalog.filter((a) => a.stable && a.chain === chain && a.type !== "perp" && a.is_active !== false);
  return stables.find((a) => a.symbol === "USDC") ?? stables[0];
}

export interface PriceSummary {
  /** Latest price, decimal string. */
  price: string;
  /** Change from the first point to the last, in percent. Display only. */
  changePct: number;
  direction: "up" | "down" | "flat";
}

/** Latest price and change across a series of points (oldest first). */
export function summarisePoints(points: { price: string }[]): PriceSummary | null {
  const usable = points.filter((p) => /^\d+(\.\d+)?$/.test(p.price));
  if (usable.length === 0) return null;
  const first = dec(usable[0].price);
  const last = dec(usable.at(-1)!.price);
  // Basis points in bigint, then a small display number: never Number() an amount.
  const bps = first > ZERO ? ((last - first) * 10_000n) / first : 0n;
  const changePct = Number(bps) / 100;
  return { price: usable.at(-1)!.price, changePct, direction: bps > 0n ? "up" : bps < 0n ? "down" : "flat" };
}

/**
 * Tidies a catalog description for the "About" section: drops a repeated
 * "About X (...)" heading, fills placeholders the catalog sometimes leaves in
 * ("[Company]", "[TICKER]"), and keeps the first couple of paragraphs.
 */
export function cleanDescription(raw: string | null | undefined, name: string, maxParagraphs = 2): string | null {
  if (!raw) return null;
  const paragraphs = raw
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^"+|"+$/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((p) => !/^About\b[^.]*$/i.test(p)) // a heading line with no sentence in it
    .map((p) =>
      p
        .replace(/^About\s[^)]*\)\s*(\([^)]*\)\s*)?/i, "") // "About Apple (Coinbase Tokenized Stock) (APPLc) ..."
        .replace(/\s*\(\[TICKER\]\)/gi, "")
        .replace(/\[Company\]/gi, name)
        .replace(/\[TICKER\]/gi, "")
        .trim(),
    )
    .filter((p) => p.length > 0);
  return paragraphs.length ? paragraphs.slice(0, maxParagraphs).join("\n\n") : null;
}
