import { describe, expect, it } from "vitest";
import { suggest, type AdvisorHolding } from "./advisor";

const now = new Date("2026-11-06T12:00:00Z");
const usdc = (free: string, available = free, chain = "solana"): AdvisorHolding => ({
  assetId: `usdc-${chain}`, ticker: "USDC", chain, stable: true, assetClass: "crypto", decimals: 6, priceUsd: "1", available, free,
});
const sol = (available: string, free = available): AdvisorHolding => ({
  assetId: "sol", ticker: "SOL", chain: "solana", stable: false, assetClass: "crypto", decimals: 9, priceUsd: "150", available, free,
});
const aapl: AdvisorHolding = {
  assetId: "aapl", ticker: "AAPL", chain: "base", stable: false, assetClass: "stock", decimals: 8, priceUsd: "220", available: "1", free: "1",
};
const stocks = [{ assetId: "aapl", ticker: "AAPL", chain: "base" }];

describe("suggest", () => {
  it("proposes selling some swinging assets when they're over the profile's share", () => {
    // $1,500 in SOL, $500 in USDC: 75% volatile against a 50% target.
    const [s] = suggest({ holdings: [usdc("50", "500"), sol("10")], stocks: [], upcoming: [], profile: "balanced", now });
    expect(s.id).toBe("reduce-risk:sol:balanced");
    expect(s.action).toEqual({ kind: "sell", assetId: "sol", qty: "3.333333" });
    expect(s.impact).toMatch(/75% → 50/);
  });

  it("only sells what isn't locked", () => {
    const [s] = suggest({ holdings: [usdc("0", "500"), sol("10", "1")], stocks: [], upcoming: [], profile: "balanced", now });
    expect(s.action).toEqual({ kind: "sell", assetId: "sol", qty: "1" });
  });

  it("stays quiet within a few percent of the target, and for a growth profile", () => {
    expect(suggest({ holdings: [usdc("50", "480"), sol("3.5")], stocks: [], upcoming: [], profile: "balanced", now })).toEqual([]);
    expect(suggest({ holdings: [usdc("50", "500"), sol("10")], stocks: [], upcoming: [], profile: "growth", now })).toEqual([]);
  });

  it("suggests locking half of a large free cash balance, in whole dollars", () => {
    const [s] = suggest({ holdings: [usdc("651")], stocks: [], upcoming: [], profile: "careful", now });
    expect(s.action).toEqual({ kind: "lock", assetId: "usdc-solana", amount: "325", days: 90 });
  });

  it("suggests a first stock only when there's USDC on the stock's network", () => {
    const onSolanaOnly = suggest({ holdings: [usdc("60")], stocks, upcoming: [], profile: "balanced", now });
    expect(onSolanaOnly.find((s) => s.action.kind === "buy")).toBeUndefined();
    const onBase = suggest({ holdings: [usdc("60", "60", "base")], stocks, upcoming: [], profile: "balanced", now });
    expect(onBase.find((s) => s.action.kind === "buy")?.action).toEqual({ kind: "buy", assetId: "aapl", amountUsd: "10" });
    const owns = suggest({ holdings: [usdc("60", "60", "base"), aapl], stocks, upcoming: [], profile: "growth", now });
    expect(owns.find((s) => s.action.kind === "buy")).toBeUndefined();
  });

  it("flags a release in the next 7 days", () => {
    const upcoming = [{ lockId: "L", goalName: "Budget", symbol: "USDC", amount: "1000", releaseAt: new Date("2026-11-10T00:00:00Z") }];
    const [s] = suggest({ holdings: [usdc("10")], stocks: [], upcoming, profile: "balanced", now });
    expect(s.action).toEqual({ kind: "link", href: "/vault/new", label: "New lock" });
    expect(suggest({ holdings: [usdc("10")], stocks: [], upcoming: [{ ...upcoming[0], releaseAt: new Date("2026-12-01T00:00:00Z") }], profile: "balanced", now })).toEqual([]);
  });

  it("is deterministic, so the server can rebuild what the user approved", () => {
    const args = { holdings: [usdc("651", "1000"), sol("10")], stocks, upcoming: [], profile: "balanced" as const, now };
    expect(suggest(args)).toEqual(suggest(args));
  });
});
