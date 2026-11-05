import { describe, expect, it } from "vitest";
import { addInterval, buildSchedule, lockedNow, nextRelease, validateSchedule } from "./schedule";
import { dec, sum, toDecimalString } from "../decimal";
import type { Lock } from "./types";

const d = (iso: string) => new Date(iso);
const plain = (tranches: { releaseAt: Date; amount: string }[]) =>
  tranches.map((t) => [t.releaseAt.toISOString().slice(0, 10), t.amount]);

describe("addInterval", () => {
  it("adds weeks and fortnights", () => {
    expect(addInterval(d("2026-12-05T09:00:00Z"), "week", 2).toISOString()).toBe("2026-12-19T09:00:00.000Z");
    expect(addInterval(d("2026-12-05T09:00:00Z"), "2weeks", 1).toISOString()).toBe("2026-12-19T09:00:00.000Z");
  });

  it("adds months on the same day, clamped to short months, without drifting", () => {
    const jan31 = d("2027-01-31T00:00:00Z");
    expect(addInterval(jan31, "month", 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(addInterval(jan31, "month", 2).toISOString().slice(0, 10)).toBe("2027-03-31");
    expect(addInterval(jan31, "month", 3).toISOString().slice(0, 10)).toBe("2027-04-30");
    expect(addInterval(d("2027-11-30T00:00:00Z"), "month", 3).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
});

describe("buildSchedule", () => {
  it("Sandra: 4,000 USDC, 25% every month", () => {
    const s = buildSchedule({ total: "4000", decimals: 6, firstAt: d("2026-12-05T00:00:00Z"), every: "month", split: { kind: "percent", percent: "25" } });
    expect(plain(s)).toEqual([
      ["2026-12-05", "1000"],
      ["2027-01-05", "1000"],
      ["2027-02-05", "1000"],
      ["2027-03-05", "1000"],
    ]);
  });

  it("gives the last release whatever is left", () => {
    const pct = buildSchedule({ total: "4000", decimals: 6, firstAt: d("2027-01-01T00:00:00Z"), every: "week", split: { kind: "percent", percent: "30" } });
    expect(pct.map((t) => t.amount)).toEqual(["1200", "1200", "1200", "400"]);

    const fixed = buildSchedule({ total: "4000", decimals: 6, firstAt: d("2027-01-01T00:00:00Z"), every: "2weeks", split: { kind: "fixed", amount: "1500" } });
    expect(fixed.map((t) => t.amount)).toEqual(["1500", "1500", "1000"]);
  });

  it("rounds each part down to the asset's decimals and still adds up exactly", () => {
    const s = buildSchedule({ total: "100", decimals: 6, firstAt: d("2027-01-01T00:00:00Z"), every: "month", split: { kind: "percent", percent: "33.333333333" } });
    expect(s.map((t) => t.amount)).toEqual(["33.333333", "33.333333", "33.333333", "0.000001"]);
    expect(toDecimalString(sum(s.map((t) => dec(t.amount))))).toBe("100");
  });

  it("refuses splits that make no sense", () => {
    const base = { total: "4000", decimals: 6, firstAt: d("2027-01-01T00:00:00Z"), every: "week" as const };
    expect(() => buildSchedule({ ...base, split: { kind: "percent", percent: "0" } })).toThrow(/percent/i);
    expect(() => buildSchedule({ ...base, split: { kind: "percent", percent: "101" } })).toThrow(/percent/i);
    expect(() => buildSchedule({ ...base, split: { kind: "fixed", amount: "5000" } })).toThrow(/more than/i);
    expect(() => buildSchedule({ ...base, split: { kind: "fixed", amount: "10" } })).toThrow(/52/);
  });
});

const sandra = (): Lock => {
  const schedule = buildSchedule({ total: "4000", decimals: 6, firstAt: d("2026-12-05T00:00:00Z"), every: "month", split: { kind: "percent", percent: "25" } });
  return {
    id: "l1",
    userId: "u1",
    assetId: "usdc",
    symbol: "USDC",
    amount: "4000",
    unlockAt: schedule.at(-1)!.releaseAt,
    schedule,
    status: "active",
    createdAt: d("2026-11-05T00:00:00Z"),
  };
};

describe("lockedNow", () => {
  it("frees each scheduled part on its date, automatically", () => {
    const lock = sandra();
    const usdc = (n: bigint) => n * 10n ** 18n;
    expect(lockedNow(lock, d("2026-12-04T23:59:59Z"))).toBe(usdc(4000n));
    expect(lockedNow(lock, d("2026-12-05T00:00:00Z"))).toBe(usdc(3000n));
    expect(lockedNow(lock, d("2027-02-20T00:00:00Z"))).toBe(usdc(1000n));
    expect(lockedNow(lock, d("2027-03-05T00:00:00Z"))).toBe(0n);
  });

  it("frees a one-date lock on its date, with no release step", () => {
    const lock: Lock = { ...sandra(), schedule: undefined, unlockAt: d("2027-01-01T00:00:00Z") };
    expect(lockedNow(lock, d("2026-12-31T23:59:59Z"))).toBe(4000n * 10n ** 18n);
    expect(lockedNow(lock, d("2027-01-01T00:00:00Z"))).toBe(0n);
  });

  it("holds nothing once a lock is closed", () => {
    expect(lockedNow({ ...sandra(), status: "released" }, d("2026-11-06T00:00:00Z"))).toBe(0n);
  });
});

describe("nextRelease", () => {
  it("is the first part still locked", () => {
    expect(nextRelease(sandra(), d("2026-12-10T00:00:00Z"))?.releaseAt.toISOString().slice(0, 10)).toBe("2027-01-05");
    expect(nextRelease(sandra(), d("2027-04-01T00:00:00Z"))).toBeUndefined();
  });
});

describe("validateSchedule", () => {
  const now = d("2026-11-05T00:00:00Z");
  it("accepts a schedule that adds up, runs forward and ends on the unlock date", () => {
    const lock = sandra();
    expect(validateSchedule(lock.amount, lock.unlockAt, lock.schedule!, now)).toBeNull();
  });

  it("rejects parts that don't add up, go backwards, start in the past or end elsewhere", () => {
    const { amount, unlockAt, schedule } = sandra();
    const s = schedule!;
    expect(validateSchedule("3999", unlockAt, s, now)).toMatch(/add up/);
    expect(validateSchedule(amount, unlockAt, [s[1], s[0], s[2], s[3]], now)).toMatch(/order/);
    expect(validateSchedule(amount, unlockAt, s, d("2026-12-06T00:00:00Z"))).toMatch(/future/);
    expect(validateSchedule(amount, d("2028-01-01T00:00:00Z"), s, now)).toMatch(/last release/);
    expect(validateSchedule(amount, unlockAt, [], now)).toMatch(/at least one/);
  });
});
