import { describe, expect, it } from "vitest";
import { countdown, formatQty, formatUsd, lockProgress } from "./format";

describe("formatUsd", () => {
  it("groups thousands and keeps two places", () => {
    expect(formatUsd("1923759.24")).toBe("$1,923,759.24");
    expect(formatUsd("0")).toBe("$0.00");
    expect(formatUsd("5")).toBe("$5.00");
  });

  it("rounds half up without floating point", () => {
    expect(formatUsd("0.005")).toBe("$0.01");
    expect(formatUsd("0.004999999999999999")).toBe("$0.00");
    expect(formatUsd("999.995")).toBe("$1,000.00");
  });

  it("puts the sign before the dollar", () => {
    expect(formatUsd("-12.5")).toBe("-$12.50");
  });
});

describe("formatQty", () => {
  it("trims to the given places and drops trailing zeros", () => {
    expect(formatQty("4.000000000")).toBe("4");
    expect(formatQty("0.123456789", 4)).toBe("0.1234");
    expect(formatQty("12500.5")).toBe("12,500.5");
  });
});

describe("countdown", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  it("counts days, then hours in the last 48 hours, then Ready", () => {
    expect(countdown(new Date("2027-03-27T12:00:00Z"), now)).toEqual({ label: "142 days", matured: false });
    expect(countdown(new Date("2026-11-06T12:00:00Z"), now)).toEqual({ label: "24 hours", matured: false });
    expect(countdown(new Date("2026-11-05T12:30:00Z"), now)).toEqual({ label: "1 hour", matured: false });
    expect(countdown(new Date("2026-11-05T11:00:00Z"), now)).toEqual({ label: "Ready", matured: true });
  });
});

describe("lockProgress", () => {
  it("is the share of the lock term that has passed, clamped to 0..1", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    const unlock = new Date("2026-01-11T00:00:00Z");
    expect(lockProgress(created, unlock, new Date("2026-01-06T00:00:00Z"))).toBeCloseTo(0.5);
    expect(lockProgress(created, unlock, new Date("2025-12-01T00:00:00Z"))).toBe(0);
    expect(lockProgress(created, unlock, new Date("2026-02-01T00:00:00Z"))).toBe(1);
  });
});
