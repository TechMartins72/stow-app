// Display formatting. Amounts stay decimal strings and bigints all the way to
// the screen (CLAUDE.md rule 5); dates and progress may use plain numbers.

import { dec, toDecimalString } from "@/engine/decimal";

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Rounds half up to `places` and returns a plain decimal string with exactly that many places. */
function round(value: string, places: number): { negative: boolean; whole: string; fraction: string } {
  const scaled = dec(value);
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const step = 10n ** BigInt(18 - places);
  const rounded = ((abs + step / 2n) / step) * step;
  const [whole, fraction = ""] = toDecimalString(rounded).split(".");
  return { negative: negative && rounded !== 0n, whole, fraction: fraction.padEnd(places, "0") };
}

export function formatUsd(value: string): string {
  const { negative, whole, fraction } = round(value, 2);
  return `${negative ? "-" : ""}$${group(whole)}.${fraction}`;
}

/** Asset quantities: truncated to `maxPlaces`, trailing zeros dropped. */
export function formatQty(value: string, maxPlaces = 6): string {
  const [whole, fraction] = toDecimalString(dec(value), maxPlaces).split(".");
  return fraction ? `${group(whole)}.${fraction}` : group(whole);
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Days remaining; hours in the last 48 hours; "Ready" at maturity. */
export function countdown(unlockAt: Date, now: Date): { label: string; matured: boolean } {
  const left = unlockAt.getTime() - now.getTime();
  if (left <= 0) return { label: "Ready", matured: true };
  if (left <= 48 * HOUR) {
    const hours = Math.ceil(left / HOUR);
    return { label: `${hours} ${hours === 1 ? "hour" : "hours"}`, matured: false };
  }
  const days = Math.ceil(left / DAY);
  return { label: `${days} days`, matured: false };
}

/** Share of the lock term already passed, 0..1. For the progress ring only. */
export function lockProgress(createdAt: Date, unlockAt: Date, now: Date): number {
  const total = unlockAt.getTime() - createdAt.getTime();
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - createdAt.getTime()) / total));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
