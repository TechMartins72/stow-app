// Product rules for buying and selling, shared by the browser and the server.
// Lessons from a live True Markets app: orders under $1.00 are refused (under
// $5.00 for stocks on Base, seen 2026-11-20), and a price that moves more than 1%
// between the quote and the signature is a reason to stop, not to trade.

import { dec, mul, toDecimalString, ZERO } from "@/engine/decimal";
import { formatQty, formatUsd } from "./format";

export const MIN_ORDER_USD = "1.00";
const MIN_BASE_STOCK_ORDER_USD = "5.00";

/** The smallest order True Markets accepts for this asset, in dollars. */
export function minOrderUsd(a: { chain: string | null; assetClass: "stock" | "crypto" }): string {
  return a.assetClass === "stock" && a.chain === "base" ? MIN_BASE_STOCK_ORDER_USD : MIN_ORDER_USD;
}
export const MAX_SLIPPAGE = "0.01";
/** How long a quote stays on screen before the user must refresh it. */
export const QUOTE_TTL_MS = 30_000;

const CENTS = /^\d+(\.\d{1,2})?$/;
const PLAIN = /^\d+(\.\d+)?$/;

/** A buy, in dollars, paid from free USDC on the asset's own network. */
export function checkBuyAmount(amount: string, freeUsdc: string, minUsd = MIN_ORDER_USD): string | null {
  const text = amount.trim();
  if (!text) return "Enter how much to spend.";
  if (!CENTS.test(text)) return "Enter dollars and cents, like 25 or 25.50.";
  if (dec(text) < dec(minUsd)) return `The minimum order is $${minUsd}.`;
  if (dec(text) > dec(freeUsdc)) return `You have ${formatUsd(freeUsdc)} free to spend.`;
  return null;
}

/** A sale, in shares, from free (unlocked) shares only, worth at least the minimum order. */
export function checkSellQty(
  qty: string,
  freeQty: string,
  decimals: number,
  priceUsd: string,
  ticker: string,
  minUsd = MIN_ORDER_USD,
): string | null {
  const text = qty.trim();
  if (!text) return "Enter how many to sell.";
  if (!PLAIN.test(text)) return "Enter a number, like 0.5.";
  if ((text.split(".")[1]?.length ?? 0) > decimals) return `${ticker} allows up to ${decimals} decimal places.`;
  if (dec(text) <= ZERO) return "The amount must be more than zero.";
  if (dec(text) > dec(freeQty)) return `You have ${formatQty(freeQty, decimals)} ${ticker} free to sell.`;
  if (mul(dec(text), dec(priceUsd)) < dec(minUsd)) return `A sale must be worth at least $${minUsd}.`;
  return null;
}

/** The least the user accepts: the quoted amount less the slippage allowance, rounded down. */
export function minAccepted(quotedOut: string, decimals: number): string {
  const floor = mul(dec(quotedOut), dec("1") - dec(MAX_SLIPPAGE));
  return toDecimalString(floor, decimals);
}

/** "Apple (Coinbase Tokenized Stock)" and "Applied Materials • Robinhood Token" both read as the company. */
export function displayName(name: string): string {
  return name.replace(/\s*[•·]\s*Robinhood Token$/i, "").replace(/\s*\(Coinbase Tokenized Stock\)$/i, "").trim();
}

/** Coinbase-tokenized stocks on Base append "C" to the ticker (AAPLC is Apple, AAPL). */
export function tickerOf(a: { symbol: string; chain: string | null; asset_class?: string }): string {
  const s = a.symbol.toUpperCase();
  return a.asset_class === "stock" && a.chain === "base" && s.endsWith("C") ? s.slice(0, -1) : s;
}
