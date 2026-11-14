import { describe, expect, it } from "vitest";
import { portfolio, type PortfolioInput } from "./portfolio";

// Shaped like the live wallet on 2026-11-13.
const usdc: PortfolioInput = {
  assetId: "usdc-sol", symbol: "USDC", chain: "solana", bucket: "cash", decimals: 6,
  total: "3.7", held: "0", locked: "1", priceUsd: "1", priceDayAgoUsd: null,
};
const sol: PortfolioInput = {
  assetId: "sol", symbol: "SOL", chain: "solana", bucket: "crypto", decimals: 9,
  total: "0.011920578", held: "0", locked: "0", priceUsd: "80", priceDayAgoUsd: "76",
};
const googl: PortfolioInput = {
  assetId: "googl", symbol: "GOOGLC", chain: "base", bucket: "stocks", decimals: 8,
  total: "0.00337568", held: "0", locked: "0.00337568", priceUsd: "300", priceDayAgoUsd: "310",
};

describe("portfolio", () => {
  const p = portfolio([usdc, sol, googl]);

  it("values each holding and splits it into free, locked and in-orders", () => {
    const s = p.rows.find((r) => r.assetId === "sol")!;
    expect(s.valueUsd).toBe("0.95364624");
    expect(s.freeQty).toBe("0.011920578");
    expect(s.lockedQty).toBe("0");
    const u = p.rows.find((r) => r.assetId === "usdc-sol")!;
    expect(u).toMatchObject({ freeQty: "2.7", lockedQty: "1", heldQty: "0", valueUsd: "3.7" });
  });

  it("caps locked at what the wallet holds, and never shows negative free", () => {
    const over = portfolio([{ ...usdc, total: "0.5", locked: "1" }]).rows[0];
    expect(over).toMatchObject({ lockedQty: "0.5", freeQty: "0" });
  });

  it("keeps money in open orders out of free", () => {
    const busy = portfolio([{ ...sol, held: "0.005" }]).rows[0];
    expect(busy).toMatchObject({ heldQty: "0.005", freeQty: "0.006920578" });
  });

  it("totals, with free and locked value", () => {
    // 3.7 + 0.95364624 + 1.012704 = 5.66635024; locked 1 + 1.012704
    expect(p.totalUsd).toBe("5.66635024");
    expect(p.lockedUsd).toBe("2.012704");
    expect(p.freeUsd).toBe("3.65364624");
  });

  it("orders holdings by value and gives each a share of the total", () => {
    expect(p.rows.map((r) => r.assetId)).toEqual(["usdc-sol", "googl", "sol"]);
    // 3.7 / 5.66635024 = 65.29%, 1.012704 / … = 17.87%, 0.95364624 / … = 16.829% (rounded down)
    expect(p.rows.map((r) => r.shareBps)).toEqual([6529, 1787, 1682]);
  });

  it("works out the 24-hour change in dollars from the price a day ago", () => {
    // SOL: 0.011920578 x (80 - 76) = +0.047682312; GOOGL: 0.00337568 x (300 - 310) = -0.0337568
    expect(p.rows.find((r) => r.assetId === "sol")!.change24hUsd).toBe("0.047682312");
    expect(p.rows.find((r) => r.assetId === "googl")!.change24hUsd).toBe("-0.0337568");
    expect(p.rows.find((r) => r.assetId === "usdc-sol")!.change24hUsd).toBeNull(); // cash doesn't move
    expect(p.change24hUsd).toBe("0.013925512");
    // Against yesterday's value of what's held now: 5.66635024 - 0.013925512 = 5.652424728 -> +0.24%
    expect(p.change24hBps).toBe(24);
  });

  it("groups value by network", () => {
    expect(p.byNetwork).toEqual([
      { chain: "solana", valueUsd: "4.65364624", bps: 8212 },
      { chain: "base", valueUsd: "1.012704", bps: 1787 },
    ]);
  });

  it("copes with an empty wallet", () => {
    const empty = portfolio([]);
    expect(empty).toMatchObject({ totalUsd: "0", change24hUsd: "0", change24hBps: 0, rows: [], byNetwork: [] });
  });
});
