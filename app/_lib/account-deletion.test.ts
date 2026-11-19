import { describe, expect, it } from "vitest";
import {
  confirmsEmail,
  deletionCheck,
  RECENT_SIGN_IN_MS,
  signedInRecently,
  type DeletionHolding,
} from "./account-deletion";

const now = new Date("2026-11-19T12:00:00Z");
const usdc = (over: Partial<DeletionHolding> = {}): DeletionHolding => ({
  assetId: "usdc",
  symbol: "USDC",
  chain: "solana",
  available: "0",
  locked: "0",
  priceUsd: "1",
  blockers: [],
  ...over,
});

describe("deleting an account never strands money", () => {
  it("is blocked while any money is locked, naming each plan and its date", () => {
    const until = new Date("2027-06-01T00:00:00Z");
    const r = deletionCheck([
      usdc({
        available: "40",
        locked: "40",
        blockers: [
          {
            goalName: "Holiday fund",
            lockedAmount: "40",
            nextReleaseAt: until,
          },
        ],
      }),
    ]);
    expect(r).toEqual({
      ok: false,
      reason: "locked",
      plans: [
        { goalName: "Holiday fund", symbol: "USDC", amount: "40", until },
      ],
    });
  });

  it("asks to withdraw first when $1 or more is free", () => {
    const r = deletionCheck([
      usdc({ available: "1" }),
      {
        ...usdc(),
        assetId: "sol",
        symbol: "SOL",
        available: "0.001",
        priceUsd: "160",
      },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok || r.reason !== "withdraw_first")
      throw new Error("expected withdraw_first");
    expect(r.holdings.map((h) => h.symbol)).toEqual(["USDC", "SOL"]);
    expect(r.totalUsd).toBe("1.16");
  });

  it("asks to withdraw first for any coin it can't price, however small", () => {
    const r = deletionCheck([
      usdc({ symbol: "XYZ", priceUsd: "0", available: "0.0001" }),
    ]);
    expect(r).toMatchObject({ ok: false, reason: "withdraw_first" });
  });

  it("allows it under $1, saying what's left behind", () => {
    expect(deletionCheck([usdc({ available: "0.42" })])).toEqual({
      ok: true,
      leftoverUsd: "0.42",
    });
  });

  it("allows it with empty wallets, with nothing left behind", () => {
    expect(deletionCheck([])).toEqual({ ok: true, leftoverUsd: "0" });
    expect(deletionCheck([usdc()])).toEqual({ ok: true, leftoverUsd: "0" });
  });
});

describe("confirming who is deleting", () => {
  it("needs a sign-in within the last 15 minutes", () => {
    expect(RECENT_SIGN_IN_MS).toBe(15 * 60_000);
    expect(signedInRecently(new Date(now.getTime() - 14 * 60_000), now)).toBe(
      true,
    );
    expect(signedInRecently(new Date(now.getTime() - 16 * 60_000), now)).toBe(
      false,
    );
  });

  it("needs the account's email typed out, ignoring case and spaces around it", () => {
    expect(confirmsEmail("  Sam@Example.com ", "sam@example.com")).toBe(true);
    expect(confirmsEmail("sam@example.co", "sam@example.com")).toBe(false);
    expect(confirmsEmail("", "sam@example.com")).toBe(false);
  });
});
