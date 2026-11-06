import { dec, ZERO } from "@/engine/decimal";
import { formatQty } from "./format";

const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Basic shape of an amount to send: a positive number the wallet holds.
 * Whether locks allow it is the guard's call, not this function's.
 */
export function checkSendAmount(amount: string, available: string, decimals: number, symbol: string): string | null {
  const text = amount.trim();
  if (!text) return "Enter an amount.";
  if (!PLAIN_DECIMAL.test(text)) return "Enter a number, like 250 or 0.5.";
  if ((text.split(".")[1]?.length ?? 0) > decimals) return `${symbol} allows up to ${decimals} decimal places.`;
  if (dec(text) <= ZERO) return "The amount must be more than zero.";
  if (dec(text) > dec(available)) return `You only have ${formatQty(available, decimals)} ${symbol}.`;
  return null;
}
