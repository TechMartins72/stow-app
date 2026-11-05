// Release schedules. A lock is a list of parts, each freed automatically on
// its date; a one-date lock is a single part. Pure functions: no I/O, no clock.

import { dec, div, mul, sum, toDecimalString, ZERO, type Dec } from "../decimal";
import type { Lock, Tranche } from "./types";

export type Interval = "week" | "2weeks" | "month";
export type Split = { kind: "percent"; percent: string } | { kind: "fixed"; amount: string };

export const MAX_TRANCHES = 52;
const DAY = 86_400_000;
const SCALE = 18;

/** `anchor` plus `n` intervals. Months keep the anchor's day, clamped to short months. */
export function addInterval(anchor: Date, every: Interval, n: number): Date {
  if (every === "week") return new Date(anchor.getTime() + 7 * n * DAY);
  if (every === "2weeks") return new Date(anchor.getTime() + 14 * n * DAY);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + n;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const out = new Date(anchor);
  out.setUTCFullYear(year, month, Math.min(anchor.getUTCDate(), lastDay));
  return out;
}

function truncate(value: Dec, decimals: number): Dec {
  const step = 10n ** BigInt(SCALE - Math.min(decimals, SCALE));
  return (value / step) * step;
}

/**
 * Splits `total` into equal parts (a percent of the total, or a fixed amount),
 * released every `every` starting at `firstAt`. Each part is rounded down to
 * the asset's decimals; the last part takes what is left, so they sum exactly.
 */
export function buildSchedule(input: {
  total: string;
  decimals: number;
  firstAt: Date;
  every: Interval;
  split: Split;
}): Tranche[] {
  const total = dec(input.total);
  if (total <= ZERO) throw new Error("The amount must be more than zero.");

  let part: Dec;
  if (input.split.kind === "percent") {
    const percent = dec(input.split.percent);
    if (percent <= ZERO || percent > dec("100")) throw new Error("The percent must be above 0 and at most 100.");
    part = truncate(div(mul(total, percent), dec("100")), input.decimals);
  } else {
    part = truncate(dec(input.split.amount), input.decimals);
    if (part > total) throw new Error("Each release can't be more than the amount locked.");
  }
  if (part <= ZERO) throw new Error("Each release must be more than zero.");

  const count = Number((total + part - 1n) / part); // ceil(total / part); a small count, not money
  if (count > MAX_TRANCHES) throw new Error(`That would take more than ${MAX_TRANCHES} releases. Release more each time.`);

  return Array.from({ length: count }, (_, i) => ({
    releaseAt: addInterval(input.firstAt, input.every, i),
    amount: toDecimalString(i < count - 1 ? part : total - part * BigInt(count - 1)),
  }));
}

/** The parts of a lock, oldest first. A one-date lock is one part. */
export function tranchesOf(lock: Pick<Lock, "amount" | "unlockAt" | "schedule">): Tranche[] {
  return lock.schedule && lock.schedule.length > 0 ? lock.schedule : [{ releaseAt: lock.unlockAt, amount: lock.amount }];
}

/** How much of this lock is still held at `now`. Parts free themselves on their date. */
export function lockedNow(lock: Lock, now: Date): Dec {
  if (lock.status !== "active") return ZERO;
  return sum(tranchesOf(lock).filter((t) => t.releaseAt > now).map((t) => dec(t.amount)));
}

export function nextRelease(lock: Lock, now: Date): Tranche | undefined {
  if (lock.status !== "active") return undefined;
  return tranchesOf(lock).find((t) => t.releaseAt > now);
}

/** Null when the schedule is sound; otherwise why not. */
export function validateSchedule(amount: string, unlockAt: Date, schedule: Tranche[], now: Date): string | null {
  if (schedule.length === 0) return "A schedule needs at least one release.";
  if (schedule.length > MAX_TRANCHES) return `A schedule can have at most ${MAX_TRANCHES} releases.`;
  for (let i = 1; i < schedule.length; i++) {
    if (schedule[i].releaseAt <= schedule[i - 1].releaseAt) return "Releases must be in date order.";
  }
  if (schedule[0].releaseAt <= now) return "Every release must be in the future.";
  if (schedule.some((t) => dec(t.amount) <= ZERO)) return "Every release must be more than zero.";
  if (sum(schedule.map((t) => dec(t.amount))) !== dec(amount)) return "The releases must add up to the amount locked.";
  if (schedule.at(-1)!.releaseAt.getTime() !== unlockAt.getTime()) return "The last release must be on the unlock date.";
  return null;
}
