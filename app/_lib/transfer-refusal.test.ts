import { describe, expect, it } from "vitest";
import { describeTransferRefusal } from "./transfer-refusal";

// The live reply for a 0.01 SOL withdrawal, 2026-11-13.
const belowMinimum = {
  type: "invalid_argument",
  code: "amount_below_minimum",
  message: "transfer amount is below minimum transfer size",
};

describe("describeTransferRefusal", () => {
  it("says plainly when an amount is below True Markets' minimum", () => {
    const r = describeTransferRefusal(belowMinimum, "SOL");
    expect(r.message).toMatch(/below the smallest SOL transfer/);
    expect(r.message).toMatch(/Nothing was sent/);
    expect(r.message).not.toMatch(/network fee/); // that hint was wrong for this case
  });

  it("names the minimum when True Markets includes it", () => {
    const r = describeTransferRefusal({ ...belowMinimum, metadata: { min_amount: "0.05" } }, "SOL");
    expect(r.message).toMatch(/smallest SOL transfer is 0\.05 SOL/);
  });

  it("keeps every detail True Markets gave, for Details and the log", () => {
    const r = describeTransferRefusal({ ...belowMinimum, metadata: { min_amount: "0.05", chain: "solana" } }, "SOL");
    expect(r.detail).toContain("invalid_argument / amount_below_minimum: transfer amount is below minimum transfer size");
    expect(r.detail).toContain("min_amount=0.05");
    expect(r.detail).toContain("chain=solana");
  });

  it("explains a missing network fee on the native coin", () => {
    const r = describeTransferRefusal({ type: "failed_precondition", code: "insufficient_native_balance", message: "x" }, "SOL");
    expect(r.message).toMatch(/network fee/);
  });

  it("falls back to a general refusal for anything else", () => {
    const r = describeTransferRefusal({ type: "internal", message: "Unexpected error" }, "USDC");
    expect(r.message).toMatch(/couldn't prepare this transfer/);
    expect(r.detail).toBe("internal: Unexpected error");
  });
});
