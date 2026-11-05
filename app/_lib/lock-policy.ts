// What a new lock may look like. Shared by the wizard (instant feedback) and
// the server action (the real check). The engine's createLock still verifies
// the amount against live balances; these are product rules on top.

import { dec, ZERO } from "@/engine/decimal";
import { buildSchedule, type Interval, type Split } from "@/engine/vault/schedule";
import type { Tranche } from "@/engine/vault/types";
import { formatQty } from "./format";

export const LOCK_MIN_DAYS = 7;
export const LOCK_MAX_DAYS = 1000;
export const GOAL_NAME_MAX = 40;

export const LOCK_PRESETS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
] as const;

const DAY = 86_400_000;
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/** Returns an error message, or null when the amount is fine. */
export function checkLockAmount(amount: string, accessible: string, decimals: number): string | null {
  const text = amount.trim();
  if (!text) return "Enter an amount.";
  if (!PLAIN_DECIMAL.test(text)) return "Enter a number, like 250 or 0.5.";
  const places = text.split(".")[1]?.length ?? 0;
  if (places > decimals) return `This asset allows up to ${decimals} decimal places.`;
  const value = dec(text);
  if (value <= ZERO) return "The amount must be more than zero.";
  if (value > dec(accessible)) return `Only ${formatQty(accessible, decimals)} is available to lock.`;
  return null;
}

export function unlockFromPreset(days: number, now: Date): Date {
  return new Date(now.getTime() + days * DAY);
}

/** `YYYY-MM-DD` from a date input, opening at 00:00 UTC that day. Null if not a real date. */
export function unlockFromDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function daysUntil(unlockAt: Date, now: Date): number {
  return Math.ceil((unlockAt.getTime() - now.getTime()) / DAY);
}

export function checkUnlockDate(unlockAt: Date, now: Date): string | null {
  const days = daysUntil(unlockAt, now);
  if (days < LOCK_MIN_DAYS) return `Pick a date at least ${LOCK_MIN_DAYS} days away.`;
  if (days > LOCK_MAX_DAYS) return `Locks can last up to ${LOCK_MAX_DAYS} days.`;
  return null;
}

// ---- Release in parts (budgeting) ----

export const SCHEDULE_PERCENTS = ["10", "20", "25", "50"] as const;
export const SCHEDULE_INTERVALS: { value: Interval; label: string; noun: string }[] = [
  { value: "week", label: "Week", noun: "week" },
  { value: "2weeks", label: "2 weeks", noun: "2 weeks" },
  { value: "month", label: "Month", noun: "month" },
];
export const MIN_PARTS = 2;

export interface SchedulePlanInput {
  /** Schedules are for stablecoins only: a fixed amount should mean a fixed value. */
  stable: boolean;
  total: string;
  decimals: number;
  firstAt: Date;
  every: Interval;
  split: Split;
}

/** Builds the release schedule, or says in plain words why it can't. */
export function planSchedule(input: SchedulePlanInput, now: Date): { schedule: Tranche[] } | { error: string } {
  if (!input.stable) return { error: "Releasing in parts works with stablecoins like USDC." };
  const firstProblem = daysUntil(input.firstAt, now) < LOCK_MIN_DAYS ? `Make the first release at least ${LOCK_MIN_DAYS} days away.` : null;
  if (firstProblem) return { error: firstProblem };
  if (input.split.kind === "fixed" && !PLAIN_DECIMAL.test(input.split.amount.trim())) return { error: "Enter how much to release each time." };
  let schedule: Tranche[];
  try {
    schedule = buildSchedule(input);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "That schedule doesn't work." };
  }
  if (schedule.length < MIN_PARTS) return { error: `Release in at least ${MIN_PARTS} parts, or lock it all until one date.` };
  if (daysUntil(schedule.at(-1)!.releaseAt, now) > LOCK_MAX_DAYS) {
    return { error: `The last release would be more than ${LOCK_MAX_DAYS} days away. Release more each time.` };
  }
  return { schedule };
}

export function checkGoalName(name: string): string | null {
  const text = name.trim();
  if (!text) return "Give this lock a name.";
  if (text.length > GOAL_NAME_MAX) return `Keep the name to ${GOAL_NAME_MAX} characters.`;
  return null;
}
