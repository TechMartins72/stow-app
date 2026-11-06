import { describe, expect, it } from "vitest";
import { checkSendAmount } from "./send-amount";

describe("checkSendAmount", () => {
  it("accepts up to what the wallet holds, locked or not", () => {
    expect(checkSendAmount("1850", "1850", 6, "USDC")).toBeNull();
    expect(checkSendAmount("0.5", "1850", 6, "USDC")).toBeNull();
  });
  it("rejects bad shapes and more than the wallet holds", () => {
    expect(checkSendAmount("", "10", 6, "USDC")).toMatch(/Enter an amount/);
    expect(checkSendAmount("1e3", "10", 6, "USDC")).toMatch(/number/);
    expect(checkSendAmount("0", "10", 6, "USDC")).toMatch(/more than zero/);
    expect(checkSendAmount("1.0000001", "10", 6, "USDC")).toMatch(/6 decimal places/);
    expect(checkSendAmount("10.01", "10", 6, "USDC")).toMatch(/only have 10 USDC/);
  });
});
