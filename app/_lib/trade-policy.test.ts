import { describe, expect, it } from "vitest";
import { checkBuyAmount, checkSellQty, displayName, minAccepted, tickerOf } from "./trade-policy";

describe("checkBuyAmount", () => {
  it("accepts dollars and cents from $1.00 up to what's free", () => {
    expect(checkBuyAmount("1", "50")).toBeNull();
    expect(checkBuyAmount("25.50", "50")).toBeNull();
    expect(checkBuyAmount("50", "50")).toBeNull();
  });
  it("explains what's wrong", () => {
    expect(checkBuyAmount("", "50")).toMatch(/Enter/);
    expect(checkBuyAmount("0.99", "50")).toMatch(/minimum order is \$1\.00/);
    expect(checkBuyAmount("1.234", "50")).toMatch(/dollars and cents/);
    expect(checkBuyAmount("50.01", "50")).toMatch(/\$50\.00 free/);
  });
});

describe("checkSellQty", () => {
  it("accepts up to the free shares, worth at least $1", () => {
    expect(checkSellQty("0.5", "3.2", 8, "220", "AAPL")).toBeNull();
  });
  it("refuses locked shares, tiny sales and bad input", () => {
    expect(checkSellQty("4", "3.2", 8, "220", "AAPL")).toMatch(/3\.2 AAPL free/);
    expect(checkSellQty("0.001", "3.2", 8, "220", "AAPL")).toMatch(/at least \$1\.00/);
    expect(checkSellQty("abc", "3.2", 8, "220", "AAPL")).toMatch(/number/);
    expect(checkSellQty("0.123456789", "3.2", 8, "220", "AAPL")).toMatch(/8 decimal places/);
  });
});

describe("minAccepted", () => {
  it("allows the price to move 1% against the user, rounded down to the asset's decimals", () => {
    expect(minAccepted("0.1", 8)).toBe("0.099");
    expect(minAccepted("21.978", 6)).toBe("21.75822");
  });
});

describe("names", () => {
  it("reads Coinbase tokenized stocks as the company", () => {
    expect(displayName("Apple (Coinbase Tokenized Stock)")).toBe("Apple");
    expect(displayName("Applied Materials • Robinhood Token")).toBe("Applied Materials");
    expect(tickerOf({ symbol: "AAPLC", chain: "base", asset_class: "stock" })).toBe("AAPL");
    expect(tickerOf({ symbol: "SOL", chain: "solana", asset_class: "crypto" })).toBe("SOL");
  });
});
