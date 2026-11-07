import { describe, expect, it } from "vitest";
import type { Asset } from "@/engine/gateway/types";
import { cashFor, cleanDescription, cryptoLabel, isInvestable, summarisePoints, tradability } from "./catalog-policy";

const asset = (over: Partial<Asset>): Asset => ({
  id: over.symbol ?? "x",
  symbol: "X",
  chain: "base",
  venue: "defi",
  asset_class: "crypto",
  type: "spot",
  stable: false,
  tradeable: true,
  is_active: true,
  status: "active",
  ...over,
});

describe("tradability", () => {
  it("reads the catalog's flags", () => {
    expect(tradability({ tradeable: true, is_active: true, status: "active" })).toBe("buy_sell");
    expect(tradability({ tradeable: true, is_active: true, status: "sell_only" })).toBe("sell_only");
    expect(tradability({ tradeable: false, is_active: true, status: "active" })).toBeNull();
    expect(tradability({ tradeable: true, is_active: false, status: "active" })).toBeNull();
    expect(tradability({ tradeable: true, is_active: true, status: "halted" })).toBeNull();
    // Older catalogs (and the mock) may omit the flags: treat as tradeable.
    expect(tradability({})).toBe("buy_sell");
  });
});

describe("isInvestable", () => {
  it("offers stocks on supported networks and approved crypto only", () => {
    expect(isInvestable(asset({ symbol: "AAPLC", asset_class: "stock", chain: "base" }))).toBe(true);
    expect(isInvestable(asset({ symbol: "SOL", chain: "solana" }))).toBe(true);
    expect(isInvestable(asset({ symbol: "ETH", chain: "base" }))).toBe(true);
    expect(isInvestable(asset({ symbol: "CBBTC", chain: "base" }))).toBe(true);
  });

  it("hides meme coins, unsupported networks, centralized venue, stablecoins, perps and untradeable assets", () => {
    expect(isInvestable(asset({ symbol: "BONK", chain: "solana" }))).toBe(false);
    expect(isInvestable(asset({ symbol: "AMD", asset_class: "stock", chain: "robinhood" }))).toBe(false);
    expect(isInvestable(asset({ symbol: "TSLA", asset_class: "stock", chain: null, venue: "cefi" }))).toBe(false);
    expect(isInvestable(asset({ symbol: "USDC", stable: true }))).toBe(false);
    expect(isInvestable(asset({ symbol: "BTC-PERP", type: "perp" }))).toBe(false);
    expect(isInvestable(asset({ symbol: "MUC", asset_class: "stock", tradeable: false }))).toBe(false);
  });

  it("keeps sell-only assets so holders can still sell", () => {
    expect(isInvestable(asset({ symbol: "SNDKC", asset_class: "stock", status: "sell_only" }))).toBe(true);
  });

  it("labels cbBTC as Bitcoin", () => {
    expect(cryptoLabel({ symbol: "CBBTC", chain: "base", name: "Coinbase Wrapped Staked BTC" })).toBe("Bitcoin");
    expect(cryptoLabel({ symbol: "SOL", chain: "solana", name: "Solana" })).toBeUndefined();
  });
});

describe("cashFor", () => {
  const catalog = [
    asset({ symbol: "USDC", chain: "base", stable: true, id: "usdc-base" }),
    asset({ symbol: "PYUSD", chain: "solana", stable: true, id: "pyusd-sol" }),
    asset({ symbol: "USDC", chain: "solana", stable: true, id: "usdc-sol" }),
    asset({ symbol: "USDG", chain: "robinhood", stable: true, id: "usdg" }),
  ];
  it("prefers USDC on the asset's own network, else that network's stablecoin", () => {
    expect(cashFor(catalog, "base")?.id).toBe("usdc-base");
    expect(cashFor(catalog, "solana")?.id).toBe("usdc-sol");
    expect(cashFor(catalog, "robinhood")?.id).toBe("usdg");
    expect(cashFor(catalog, "arbitrum")).toBeUndefined();
  });
});

describe("summarisePoints", () => {
  it("gives the latest price and the change over the series", () => {
    expect(summarisePoints([{ price: "100" }, { price: "103.5" }])).toEqual({ price: "103.5", changePct: 3.5, direction: "up" });
    expect(summarisePoints([{ price: "343.30" }, { price: "343.13" }])).toEqual({ price: "343.13", changePct: -0.04, direction: "down" });
    expect(summarisePoints([{ price: "5" }])).toEqual({ price: "5", changePct: 0, direction: "flat" });
    expect(summarisePoints([])).toBeNull();
  });
});

describe("cleanDescription", () => {
  it("drops the repeated heading and fills placeholders", () => {
    expect(cleanDescription("About Apple (Coinbase Tokenized Stock) (APPLc)\n\nApple (Coinbase Tokenized Stock) is an onchain certificate.", "Apple")).toBe(
      "Apple (Coinbase Tokenized Stock) is an onchain certificate.",
    );
    expect(cleanDescription("About Tesla (Coinbase Tokenized Stock) TSLAc Tesla tracks shares of [Company].", "Tesla")).toBe("TSLAc Tesla tracks shares of Tesla.");
    expect(cleanDescription("About Microsoft (Coinbase Tokenized Stock) ([TICKER])\n\nIt tracks [Company].", "Microsoft")).toBe("It tracks Microsoft.");
  });

  it("keeps plain descriptions, trims to two paragraphs, and handles empty ones", () => {
    expect(cleanDescription("One.\n\nTwo.\n\nThree.", "X")).toBe("One.\n\nTwo.");
    expect(cleanDescription("", "X")).toBeNull();
    expect(cleanDescription(undefined, "X")).toBeNull();
  });
});
