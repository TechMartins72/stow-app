import { describe, expect, it } from "vitest";
import {
  checkGoalName,
  checkLockAmount,
  checkUnlockDate,
  daysUntil,
  planSchedule,
  unlockFromDateInput,
  unlockFromPreset,
} from "./lock-policy";

const now = new Date("2026-11-05T12:00:00Z");

describe("checkLockAmount", () => {
  it("accepts a positive amount up to what's accessible", () => {
    expect(checkLockAmount("100", "1850", 6)).toBeNull();
    expect(checkLockAmount("1850", "1850", 6)).toBeNull();
    expect(checkLockAmount("0.000001", "1", 6)).toBeNull();
  });

  it("rejects empty, zero, negative and malformed amounts", () => {
    expect(checkLockAmount("", "10", 6)).toMatch(/Enter an amount/);
    expect(checkLockAmount("0", "10", 6)).toMatch(/more than zero/);
    expect(checkLockAmount("-1", "10", 6)).toMatch(/number/);
    expect(checkLockAmount("1e3", "10", 6)).toMatch(/number/);
    expect(checkLockAmount("1,000", "10", 6)).toMatch(/number/);
  });

  it("rejects more than is accessible", () => {
    expect(checkLockAmount("1850.000001", "1850", 6)).toMatch(/Only 1,850 is available/);
  });

  it("rejects more decimal places than the asset has", () => {
    expect(checkLockAmount("1.1234567", "10", 6)).toMatch(/6 decimal places/);
  });
});

describe("unlock dates", () => {
  it("presets add whole days", () => {
    expect(unlockFromPreset(90, now).toISOString()).toBe("2027-02-03T12:00:00.000Z");
  });

  it("a picked date opens at the start of that day, UTC", () => {
    expect(unlockFromDateInput("2027-01-15")?.toISOString()).toBe("2027-01-15T00:00:00.000Z");
    expect(unlockFromDateInput("2027-02-30")).toBeNull();
    expect(unlockFromDateInput("soon")).toBeNull();
  });

  it("counts days left, rounding up", () => {
    expect(daysUntil(new Date("2026-11-12T00:00:00Z"), now)).toBe(7);
  });

  it("allows 7 to 1000 days", () => {
    expect(checkUnlockDate(unlockFromPreset(7, now), now)).toBeNull();
    expect(checkUnlockDate(unlockFromPreset(1000, now), now)).toBeNull();
    expect(checkUnlockDate(unlockFromPreset(6, now), now)).toMatch(/at least 7 days/);
    expect(checkUnlockDate(unlockFromPreset(1001, now), now)).toMatch(/1000 days/);
    expect(checkUnlockDate(new Date("2026-11-01T00:00:00Z"), now)).toMatch(/at least 7 days/);
  });
});

describe("planSchedule", () => {
  const base = {
    stable: true,
    total: "4000",
    decimals: 6,
    firstAt: new Date("2026-12-05T12:00:00Z"),
    every: "month" as const,
    split: { kind: "percent" as const, percent: "25" },
  };

  it("plans Sandra's 4 monthly releases of 1,000", () => {
    const plan = planSchedule(base, now);
    expect("schedule" in plan && plan.schedule.map((t) => t.amount)).toEqual(["1000", "1000", "1000", "1000"]);
  });

  it("is for stablecoins only", () => {
    expect(planSchedule({ ...base, stable: false }, now)).toEqual({ error: expect.stringMatching(/stablecoin/i) });
  });

  it("needs at least two releases", () => {
    expect(planSchedule({ ...base, split: { kind: "percent", percent: "100" } }, now)).toEqual({ error: expect.stringMatching(/at least 2/) });
  });

  it("keeps the first release at least 7 days away and the last within 1000 days", () => {
    expect(planSchedule({ ...base, firstAt: new Date("2026-11-08T12:00:00Z") }, now)).toEqual({ error: expect.stringMatching(/7 days/) });
    const long = { ...base, every: "month" as const, split: { kind: "percent" as const, percent: "2" } }; // 50 months
    expect(planSchedule(long, now)).toEqual({ error: expect.stringMatching(/1000 days/) });
  });

  it("passes on the engine's own errors in plain words", () => {
    expect(planSchedule({ ...base, split: { kind: "fixed", amount: "5000" } }, now)).toEqual({ error: expect.stringMatching(/more than/) });
  });
});

describe("checkGoalName", () => {
  it("needs 1 to 40 characters after trimming", () => {
    expect(checkGoalName("Rent for 2027")).toBeNull();
    expect(checkGoalName("   ")).toMatch(/Give/);
    expect(checkGoalName("x".repeat(41))).toMatch(/40/);
  });
});
