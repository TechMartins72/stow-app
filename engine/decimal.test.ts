import { describe, expect, it } from "vitest";
import { dec, div, mul, toDecimalString } from "./decimal";

describe("decimal", () => {
  it("round-trips decimal strings exactly", () => {
    for (const value of ["0", "1", "0.1", "123.456789", "-2.5", "0.000000000000000001"]) {
      expect(toDecimalString(dec(value))).toBe(value);
    }
  });

  it("adds without float error", () => {
    expect(toDecimalString(dec("0.1") + dec("0.2"))).toBe("0.3");
  });

  it("multiplies and divides", () => {
    expect(toDecimalString(mul(dec("2.5"), dec("4")))).toBe("10");
    expect(toDecimalString(div(dec("1"), dec("3")), 6)).toBe("0.333333");
  });

  it("rejects non-decimal input", () => {
    expect(() => dec("1e-7")).toThrow();
    expect(() => dec("abc")).toThrow();
  });
});
