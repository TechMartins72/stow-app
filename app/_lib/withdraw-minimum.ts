// The smallest withdrawals True Markets accepts, where we know them. True Markets
// refuses anything smaller (code `amount_below_minimum`) without saying the limit, so
// we check first and tell people up front. Seen live on 2026-11-18: $5 of SOL or USDT
// on Solana. The check uses the displayed price, so True Markets still has the final
// say near the line; its refusal is explained with the same number.

import { dec, div, mul, toDecimalString, ZERO } from "@/engine/decimal";

const MINIMUM_USD: Record<string, string> = {
  "solana:SOL": "5.00",
  "solana:USDT": "5.00",
};

const SHOWN_PLACES = 4;

export function withdrawMinimumUsd(
  chain: string | null,
  symbol: string,
): string | null {
  return chain ? (MINIMUM_USD[`${chain}:${symbol}`] ?? null) : null;
}

interface Asset {
  chain: string | null;
  symbol: string;
  decimals: number;
  /** Today's price in USD; "0" when unknown. */
  priceUsd: string;
}

/** The minimum in coins at today's price, rounded up so sending it clears the line. */
function minimumQty(minUsd: string, a: Asset): string | null {
  if (dec(a.priceUsd) <= ZERO) return null;
  const places = Math.min(a.decimals, SHOWN_PLACES);
  const step = 10n ** BigInt(18 - places);
  const exact = div(dec(minUsd), dec(a.priceUsd));
  return toDecimalString(((exact + step - 1n) / step) * step, places);
}

/** Null when the amount is fine (or there's no known minimum); otherwise what to send instead. */
export function checkWithdrawMinimum(
  a: Asset & { qty: string },
): string | null {
  const minUsd = withdrawMinimumUsd(a.chain, a.symbol);
  if (!minUsd || dec(a.priceUsd) <= ZERO) return null; // unknown price: True Markets decides
  if (mul(dec(a.qty), dec(a.priceUsd)) >= dec(minUsd)) return null;
  return `The smallest ${a.symbol} withdrawal is $${minUsd} (about ${minimumQty(minUsd, a)} ${a.symbol} right now). Enter at least that much.`;
}

/** The line shown under the amount box, for assets with a known minimum. */
export function withdrawMinimumNote(a: Asset): string | null {
  const minUsd = withdrawMinimumUsd(a.chain, a.symbol);
  if (!minUsd) return null;
  const qty = minimumQty(minUsd, a);
  return qty
    ? `Minimum withdrawal: $${minUsd} (about ${qty} ${a.symbol}).`
    : `Minimum withdrawal: $${minUsd} worth of ${a.symbol}.`;
}
