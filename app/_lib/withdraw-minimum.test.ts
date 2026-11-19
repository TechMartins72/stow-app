import { describe, expect, it } from "vitest";
import {
  checkWithdrawMinimum,
  withdrawMinimumNote,
  withdrawMinimumUsd,
} from "./withdraw-minimum";
import { describeTransferRefusal } from "./transfer-refusal";

// True Markets refuses withdrawals under $5 of SOL or USDT on Solana (seen live, 2026-11-18).
const sol = { chain: "solana", symbol: "SOL", decimals: 9, priceUsd: "160" };
const usdt = { chain: "solana", symbol: "USDT", decimals: 6, priceUsd: "1" };

describe("withdrawal minimums", () => {
  it("knows the $5 minimum for SOL and USDT on Solana, and nothing else", () => {
    expect(withdrawMinimumUsd("solana", "SOL")).toBe("5.00");
    expect(withdrawMinimumUsd("solana", "USDT")).toBe("5.00");
    expect(withdrawMinimumUsd("solana", "USDC")).toBeNull();
    expect(withdrawMinimumUsd("base", "USDT")).toBeNull();
    expect(withdrawMinimumUsd(null, "SOL")).toBeNull();
  });

  it("refuses less than $5 worth, and says how much to send instead", () => {
    const msg = checkWithdrawMinimum({ ...sol, qty: "0.01" }); // $1.60
    expect(msg).toMatch(/\$5\.00/);
    expect(msg).toMatch(/about 0\.0313 SOL/); // 5 / 160 = 0.03125, rounded up
    expect(checkWithdrawMinimum({ ...usdt, qty: "4.99" })).toMatch(/5 USDT/);
  });

  it("allows $5 or more, and anything without a known minimum", () => {
    expect(checkWithdrawMinimum({ ...sol, qty: "0.03125" })).toBeNull();
    expect(checkWithdrawMinimum({ ...usdt, qty: "5" })).toBeNull();
    expect(
      checkWithdrawMinimum({ ...usdt, symbol: "USDC", qty: "0.5" }),
    ).toBeNull();
  });

  it("leaves the decision to True Markets when the price is unknown", () => {
    expect(
      checkWithdrawMinimum({ ...sol, priceUsd: "0", qty: "0.001" }),
    ).toBeNull();
    expect(withdrawMinimumNote({ ...sol, priceUsd: "0" })).toMatch(
      /\$5\.00 worth of SOL/,
    );
  });

  it("has a note for the form, only where a minimum applies", () => {
    expect(withdrawMinimumNote(sol)).toMatch(
      /Minimum withdrawal: \$5\.00 \(about 0\.0313 SOL\)/,
    );
    expect(withdrawMinimumNote({ ...usdt, symbol: "USDC" })).toBeNull();
  });

  it("explains True Markets' own refusal with the known minimum", () => {
    const r = describeTransferRefusal(
      {
        type: "invalid_argument",
        code: "amount_below_minimum",
        message: "transfer amount is below minimum transfer size",
      },
      "SOL",
      "5.00",
    );
    expect(r.message).toMatch(/smallest SOL withdrawal is \$5\.00/);
    expect(r.message).toMatch(/Nothing was sent/);
  });
});
