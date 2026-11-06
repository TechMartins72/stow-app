import { describe, expect, it } from "vitest";
import { accessibleBalance, checkAction, type RuleContext } from "./rules";
import type { Lock, ProposedAction } from "./types";

const USDC = "usdc-solana";
const SOL = "sol-solana";

const lock = (amount: string, status: Lock["status"] = "active"): Lock => ({
  id: `lock-${amount}-${status}`,
  userId: "u1",
  assetId: USDC,
  symbol: "USDC",
  amount,
  unlockAt: new Date("2027-06-01T00:00:00Z"),
  status,
  createdAt: new Date("2026-11-01T00:00:00Z"),
});

const ctx = (overrides: Partial<RuleContext> = {}): RuleContext => ({
  balances: [
    { asset_id: USDC, available: "100" },
    { asset_id: SOL, available: "2" },
  ],
  locks: [lock("60")],
  guardrails: { allowPerps: false },
  spentTodayUsd: "0",
  now: new Date("2026-11-05T12:00:00Z"),
  ...overrides,
});

const buy = (usd: string, extra: Partial<ProposedAction> = {}): ProposedAction => ({
  kind: "buy",
  actor: "user",
  assetId: SOL,
  symbol: "SOL",
  productType: "spot",
  debits: [{ assetId: USDC, symbol: "USDC", qty: usd }],
  notionalUsd: usd,
  ...extra,
});

const withdraw = (qty: string): ProposedAction => ({
  kind: "transfer",
  actor: "user",
  assetId: USDC,
  symbol: "USDC",
  productType: "spot",
  debits: [{ assetId: USDC, symbol: "USDC", qty }],
  notionalUsd: qty,
});

const rules = (action: ProposedAction, c = ctx()) => checkAction(action, c).violations.map((v) => v.rule);

describe("accessibleBalance", () => {
  it("subtracts active locks only", () => {
    const c = ctx({ locks: [lock("60"), lock("30", "released")] });
    expect(accessibleBalance(USDC, c)).toEqual({ available: 100n * 10n ** 18n, locked: 60n * 10n ** 18n, accessible: 40n * 10n ** 18n });
  });

  it("never goes below zero", () => {
    expect(accessibleBalance(USDC, ctx({ balances: [{ asset_id: USDC, available: "10" }] })).accessible).toBe(0n);
  });
});

describe("locks", () => {
  it("allows spending within the accessible amount", () => {
    expect(checkAction(buy("40"), ctx()).allowed).toBe(true);
    expect(checkAction(withdraw("40"), ctx()).allowed).toBe(true);
  });

  it("blocks a withdrawal that reaches into locked funds", () => {
    const decision = checkAction(withdraw("41"), ctx());
    expect(decision.allowed).toBe(false);
    expect(decision.violations[0]).toMatchObject({ rule: "locked" });
    expect(decision.violations[0].message).toContain("until 2027-06-01");
  });

  it("blocks a buy that would spend locked funds", () => {
    expect(rules(buy("50"))).toEqual(["locked"]);
  });

  it("frees a matured lock automatically, with no release step", () => {
    const matured = { ...lock("60"), unlockAt: new Date("2020-01-01T00:00:00Z") };
    expect(rules(withdraw("100"), ctx({ locks: [matured] }))).toEqual([]);
  });

  it("frees scheduled parts as their dates pass, and blocks the rest", () => {
    const parts = ["2026-12-05", "2027-01-05", "2027-02-05", "2027-03-05"].map((day) => ({
      releaseAt: new Date(`${day}T00:00:00Z`),
      amount: "15",
    }));
    const scheduled: Lock = { ...lock("60"), unlockAt: parts[3].releaseAt, schedule: parts };
    const on = (iso: string) => ctx({ locks: [scheduled], now: new Date(iso) });
    // Wallet holds 100, 60 locked in four parts of 15.
    expect(rules(withdraw("41"), on("2026-12-01T00:00:00Z"))).toEqual(["locked"]);
    expect(rules(withdraw("55"), on("2026-12-05T00:00:00Z"))).toEqual([]);
    expect(rules(withdraw("56"), on("2026-12-05T00:00:00Z"))).toEqual(["locked"]);
    expect(rules(withdraw("100"), on("2027-03-05T00:00:00Z"))).toEqual([]);
  });

  it("names the next release date when it blocks", () => {
    const parts = [
      { releaseAt: new Date("2027-01-05T00:00:00Z"), amount: "30" },
      { releaseAt: new Date("2027-02-05T00:00:00Z"), amount: "30" },
    ];
    const scheduled: Lock = { ...lock("60"), unlockAt: parts[1].releaseAt, schedule: parts };
    const [violation] = checkAction(withdraw("100"), ctx({ locks: [scheduled] })).violations;
    expect(violation.message).toContain("2027-01-05");
  });

  it("reports a plain shortfall when the wallet doesn't hold enough", () => {
    expect(rules(withdraw("150"))).toEqual(["insufficient_balance"]);
  });

  it("applies to the advisor exactly as to the user", () => {
    expect(rules(buy("50", { actor: "advisor" }))).toEqual(["locked"]);
  });
});

describe("guardrails", () => {
  it("blocks perps while leverage is off", () => {
    expect(rules(buy("10", { productType: "perp" }))).toEqual(["perps_disabled"]);
  });

  it("enforces the allowed asset list for trades, not withdrawals", () => {
    const c = ctx({ guardrails: { allowPerps: false, allowedAssetIds: [USDC] } });
    expect(rules(buy("10"), c)).toEqual(["asset_not_allowed"]);
    expect(rules(withdraw("10"), c)).toEqual([]);
  });

  it("enforces the single trade limit", () => {
    const c = ctx({ guardrails: { allowPerps: false, maxSingleTradeUsd: "25" } });
    expect(rules(buy("30"), c)).toEqual(["single_trade_limit"]);
    expect(rules(buy("25"), c)).toEqual([]);
  });

  it("counts today's spend toward the daily limit", () => {
    const c = ctx({ guardrails: { allowPerps: false, maxDailySpendUsd: "50" }, spentTodayUsd: "30" });
    expect(rules(buy("20"), c)).toEqual([]);
    const decision = checkAction(buy("21"), c);
    expect(decision.violations.map((v) => v.rule)).toEqual(["daily_limit"]);
    expect(decision.violations[0].message).toContain("$20 left");
  });

  it("doesn't count sells as spending", () => {
    const c = ctx({ guardrails: { allowPerps: false, maxDailySpendUsd: "1" }, spentTodayUsd: "1" });
    const sell: ProposedAction = { ...buy("100"), kind: "sell", debits: [{ assetId: SOL, symbol: "SOL", qty: "1" }] };
    expect(rules(sell, c)).toEqual([]);
  });
});

describe("MemoryVaultStore.listLog", () => {
  it("returns one user's decisions, newest first, up to the limit", async () => {
    const { MemoryVaultStore } = await import("./store");
    const store = new MemoryVaultStore();
    const entry = (userId: string, iso: string) => ({
      userId,
      actor: "user" as const,
      kind: "transfer" as const,
      assetId: USDC,
      symbol: "USDC",
      notionalUsd: "1",
      outcome: "blocked" as const,
      violations: [],
      at: new Date(iso),
    });
    await store.appendLog(entry("u1", "2026-11-01T00:00:00Z"));
    await store.appendLog(entry("u2", "2026-11-02T00:00:00Z"));
    await store.appendLog(entry("u1", "2026-11-03T00:00:00Z"));
    await store.appendLog(entry("u1", "2026-11-02T00:00:00Z"));
    const log = await store.listLog("u1", 2);
    expect(log.map((e) => e.at.toISOString().slice(0, 10))).toEqual(["2026-11-03", "2026-11-02"]);
  });
});
