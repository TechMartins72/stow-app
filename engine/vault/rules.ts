// Pure lock and guardrail checks. The SigningGuard runs these before it signs
// anything; keep them free of I/O so they are easy to test exhaustively.

import { dec, sum, toDecimalString, ZERO, type Dec } from "../decimal";
import type { BalanceItem } from "../gateway/types";
import type { Decision, Guardrails, Lock, ProposedAction, Violation } from "./types";

export interface RuleContext {
  balances: Pick<BalanceItem, "asset_id" | "available">[];
  locks: Lock[];
  guardrails: Guardrails;
  /** USD already spent today (buys and withdrawals that executed). */
  spentTodayUsd: string;
}

export interface Accessible {
  available: Dec;
  locked: Dec;
  accessible: Dec;
}

/** What the user can move: the wallet's available amount minus active locks on that asset. */
export function accessibleBalance(assetId: string, ctx: Pick<RuleContext, "balances" | "locks">): Accessible {
  const available = sum(ctx.balances.filter((b) => b.asset_id === assetId).map((b) => dec(b.available)));
  // Matured locks still hold funds until the user releases them.
  const locked = sum(ctx.locks.filter((l) => l.assetId === assetId && l.status === "active").map((l) => dec(l.amount)));
  const accessible = available - locked;
  return { available, locked, accessible: accessible > ZERO ? accessible : ZERO };
}

export function checkAction(action: ProposedAction, ctx: RuleContext): Decision {
  const violations: Violation[] = [];
  const { guardrails } = ctx;
  const notional = dec(action.notionalUsd);

  if (action.productType === "perp" && !guardrails.allowPerps) {
    violations.push({ rule: "perps_disabled", message: "Leveraged (perpetual) trading is turned off." });
  }

  if (guardrails.allowedAssetIds && action.kind !== "transfer" && !guardrails.allowedAssetIds.includes(action.assetId)) {
    violations.push({ rule: "asset_not_allowed", message: `${action.symbol} isn't in your allowed assets.` });
  }

  for (const debit of action.debits) {
    const qty = dec(debit.qty);
    const { available, locked, accessible } = accessibleBalance(debit.assetId, ctx);
    if (qty <= accessible) continue;
    if (qty <= available && locked > ZERO) {
      const lockedHere = ctx.locks.filter((l) => l.assetId === debit.assetId && l.status === "active");
      const nextUnlock = lockedHere.map((l) => l.unlockAt).sort((a, b) => a.getTime() - b.getTime())[0];
      violations.push({
        rule: "locked",
        message:
          `${toDecimalString(locked, 6)} ${debit.symbol} is locked` +
          (nextUnlock ? ` until ${nextUnlock.toISOString().slice(0, 10)}` : "") +
          `. You can use ${toDecimalString(accessible, 6)} ${debit.symbol}.`,
      });
    } else {
      violations.push({
        rule: "insufficient_balance",
        message: `Not enough ${debit.symbol}. You can use ${toDecimalString(accessible, 6)} ${debit.symbol}.`,
      });
    }
  }

  if (guardrails.maxSingleTradeUsd && action.kind !== "transfer" && notional > dec(guardrails.maxSingleTradeUsd)) {
    violations.push({
      rule: "single_trade_limit",
      message: `Over your $${guardrails.maxSingleTradeUsd} limit for a single trade.`,
    });
  }

  // Sells convert to cash and don't count as spending.
  if (guardrails.maxDailySpendUsd && action.kind !== "sell") {
    const limit = dec(guardrails.maxDailySpendUsd);
    const spent = dec(ctx.spentTodayUsd);
    if (spent + notional > limit) {
      const left = limit - spent > ZERO ? limit - spent : ZERO;
      violations.push({
        rule: "daily_limit",
        message: `Over your $${guardrails.maxDailySpendUsd} daily limit. You have $${toDecimalString(left, 2)} left today.`,
      });
    }
  }

  return { allowed: violations.length === 0, violations };
}
