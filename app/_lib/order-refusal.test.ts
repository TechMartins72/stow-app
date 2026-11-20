import { describe, expect, it } from "vitest";
import { describeOrderRefusal } from "./order-refusal";

const ctx = { side: "buy" as const, ticker: "AAPL", chain: "base" };

describe("describeOrderRefusal", () => {
  it("says which network's coin is missing for the network fee", () => {
    const r = describeOrderRefusal(
      {
        type: "failed_precondition",
        code: "insufficient_native_balance",
        message: "x",
      },
      ctx,
    );
    expect(r.message).toMatch(/ETH on Base/);
    expect(r.message).toMatch(/Nothing was traded/);
    expect(
      describeOrderRefusal(
        { type: "failed_precondition", code: "insufficient_native_balance" },
        { ...ctx, chain: "solana" },
      ).message,
    ).toMatch(/SOL on Solana/);
  });

  it("says which network's cash is short", () => {
    const r = describeOrderRefusal(
      { type: "failed_precondition", code: "insufficient_balance" },
      ctx,
    );
    expect(r.message).toMatch(/USDC on Base/);
  });

  it("explains restrictions on the person or the asset", () => {
    expect(
      describeOrderRefusal(
        { type: "permission_denied", code: "country_restricted" },
        ctx,
      ).message,
    ).toMatch(/isn't available where you are/);
    expect(
      describeOrderRefusal(
        { type: "failed_precondition", code: "buy_not_allowed" },
        ctx,
      ).message,
    ).toMatch(/isn't allowing buys of AAPL/);
    expect(
      describeOrderRefusal(
        { type: "failed_precondition", code: "sell_not_allowed" },
        { ...ctx, side: "sell" },
      ).message,
    ).toMatch(/isn't allowing sales of AAPL/);
  });

  it("explains size and market conditions", () => {
    expect(
      describeOrderRefusal(
        { type: "invalid_argument", code: "amount_below_minimum" },
        ctx,
      ).message,
    ).toMatch(/smallest AAPL order/);
    expect(
      describeOrderRefusal(
        { type: "failed_precondition", code: "no_liquidity" },
        ctx,
      ).message,
    ).toMatch(/smaller amount, or try later/);
    expect(
      describeOrderRefusal(
        { type: "failed_precondition", code: "quote_stale" },
        ctx,
      ).message,
    ).toMatch(/price changed/);
  });

  it("keeps True Markets' own words for Details, and falls back to a general refusal", () => {
    const r = describeOrderRefusal(
      {
        type: "failed_precondition",
        code: "something_new",
        message: "Venue paused",
        metadata: { venue: "defi" },
      },
      ctx,
    );
    expect(r.message).toBe(
      "True Markets declined the order. Nothing was traded.",
    );
    expect(r.detail).toBe(
      "failed_precondition / something_new: Venue paused (venue=defi)",
    );
  });
});
