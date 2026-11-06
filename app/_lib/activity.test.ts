import { describe, expect, it } from "vitest";
import type { TransactionRow } from "@/engine/gateway/types";
import type { ActionLogEntry, Lock } from "@/engine/vault/types";
import { buildActivity, dayLabel, filterActivity } from "./activity";

const now = new Date("2026-11-06T12:00:00Z");

const buy: TransactionRow = {
  id: "o1",
  type: "order",
  status: "completed",
  created_at: "2026-11-06T10:00:00Z",
  order: { order_id: "o1", side: "buy", type: "market", qty: "22", qty_unit: "quote", executed_qty: "0.1", asset_symbol: "AAPLC", status: "complete" },
};
const send: TransactionRow = {
  id: "t1",
  type: "transfer",
  status: "completed",
  created_at: "2026-11-05T09:00:00Z",
  transfer: {
    id: "t1", status: "completed", asset_id: "u", asset_symbol: "USDC", chain: "solana", to: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    qty: "50", sent: "50", fee: "0", received: "50", tx_hash: "h", payloads: [], created_at: "2026-11-05T09:00:00Z", updated_at: "",
  },
};
const log: ActionLogEntry[] = [
  { userId: "u", actor: "advisor", kind: "buy", assetId: "a", symbol: "AAPLC", notionalUsd: "22", outcome: "executed", violations: [], gatewayRef: "o1", at: new Date("2026-11-06T10:00:00Z") },
  {
    userId: "u", actor: "user", kind: "transfer", assetId: "u", symbol: "USDC", notionalUsd: "1000", outcome: "blocked",
    violations: [{ rule: "locked", message: "1200 USDC is locked until 2027-03-27." }], at: new Date("2026-11-06T11:00:00Z"),
  },
];
const lock: Lock = {
  id: "L1", userId: "u", assetId: "u", symbol: "USDC", amount: "100", status: "active", goalName: "Budget",
  createdAt: new Date("2026-10-01T00:00:00Z"), unlockAt: new Date("2026-12-01T00:00:00Z"),
  schedule: [
    { releaseAt: new Date("2026-11-01T00:00:00Z"), amount: "50" },
    { releaseAt: new Date("2026-12-01T00:00:00Z"), amount: "50" },
  ],
};

describe("buildActivity", () => {
  const items = buildActivity({ transactions: [buy, send], log, locks: [lock], now });

  it("merges every source, newest first", () => {
    expect(items.map((i) => i.title)).toEqual([
      "Send USDC refused",
      "Bought 0.1 AAPLC",
      "Sent 50 USDC",
      "50 USDC unlocked",
      "Locked 100 USDC",
    ]);
  });

  it("credits the advisor when it placed the order, and explains refusals", () => {
    expect(items.find((i) => i.kind === "buy")?.actor).toBe("advisor");
    expect(items.find((i) => i.kind === "blocked")).toMatchObject({ status: "blocked", detail: expect.stringContaining("locked") });
  });

  it("only lists parts that have actually unlocked", () => {
    expect(items.filter((i) => i.kind === "release")).toHaveLength(1);
  });

  it("filters by kind", () => {
    expect(filterActivity(items, "locks").map((i) => i.kind)).toEqual(["release", "lock"]);
    expect(filterActivity(items, "blocked")).toHaveLength(1);
  });
});

describe("dayLabel", () => {
  it("says Today, Yesterday, then the date", () => {
    expect(dayLabel(new Date("2026-11-06T01:00:00Z"), now)).toBe("Today");
    expect(dayLabel(new Date("2026-11-05T23:00:00Z"), now)).toBe("Yesterday");
    expect(dayLabel(new Date("2026-11-01T10:00:00Z"), now)).toMatch(/Nov 1, 2026/);
  });
});

describe("tickers", () => {
  it("shows the ticker people know instead of the token symbol", () => {
    const items = buildActivity({ transactions: [buy], log: [], locks: [], now, tickers: { AAPLC: "AAPL" } });
    expect(items[0].title).toBe("Bought 0.1 AAPL");
  });
});
