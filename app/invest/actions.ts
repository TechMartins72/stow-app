"use server";

import { z } from "zod";
import { dec, toDecimalString } from "@/engine/decimal";
import { createLock, isGatewayError, LockError } from "@/engine";
import { formatDate, formatQty } from "@/app/_lib/format";
import { checkUnlockDate, unlockFromPreset } from "@/app/_lib/lock-policy";
import {
  checkBuyAmount,
  checkSellQty,
  minAccepted,
  minOrderUsd,
} from "@/app/_lib/trade-policy";
import { describeOrderRefusal } from "@/app/_lib/order-refusal";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { isChartRange } from "@/app/_lib/chart-ranges";
import {
  findInvestable,
  loadChart,
  loadMarketAsset,
  type ChartData,
} from "@/app/_server/market";

/** `detail` is True Markets' own explanation (shown only under "Details"), when it gave one. */
type Fail = { ok: false; message: string; requestId?: string; detail?: string };
type OrderCtx = {
  side: "buy" | "sell";
  ticker: string;
  chain: string | null;
} | null;

export type BuyQuote =
  | {
      ok: true;
      shares: string;
      priceUsd: string;
      feeUsd: string;
      totalUsd: string;
      minQtyOut: string;
      quotedAt: number;
    }
  | Fail;
export type SellQuote =
  | {
      ok: true;
      proceedsUsd: string;
      priceUsd: string;
      feeUsd: string;
      minQtyOut: string;
      quotedAt: number;
    }
  | Fail;
export type TradeResult =
  | Fail
  | { ok: true; outcome: "blocked"; reasons: string[] }
  | {
      ok: true;
      outcome: "done";
      status: "complete" | "pending" | "failed";
      qty: string;
      lock?: { id: string; unlockAt: string } | null;
      lockError?: string;
    };

const Id = z.string().min(1);
const Money = z.string().max(32);

async function context(assetId: string) {
  const engine = getEngine();
  const user = await getCurrentUser(engine);
  const found = await loadMarketAsset(engine, user, assetId, { chart: false });
  return { engine, user, found };
}

/** What a buy would give right now. Signs nothing. */
export async function quoteBuyAction(input: {
  assetId: string;
  amount: string;
}): Promise<BuyQuote> {
  const p = z.object({ assetId: Id, amount: Money }).safeParse(input);
  if (!p.success)
    return { ok: false, message: "Something in the form looks wrong." };
  let ctx: OrderCtx = null;
  try {
    const { engine, user, found } = await context(p.data.assetId);
    if (found)
      ctx = {
        side: "buy",
        ticker: found.asset.ticker,
        chain: found.asset.chain,
      };
    if (!found || found.asset.tradability === "sell_only")
      return { ok: false, message: "That asset can't be bought right now." };
    if (!found.paying)
      return {
        ok: false,
        message: `There's nothing to pay with on ${found.asset.chain} yet.`,
      };
    const amount = p.data.amount.trim();
    const problem = checkBuyAmount(
      amount,
      found.paying.free,
      minOrderUsd(found.asset),
    );
    if (problem) return { ok: false, message: problem };
    const q = await engine.client.quote(user.gatewayUserId, {
      asset_id: found.asset.assetId,
      side: "buy",
      qty: amount,
      qty_unit: "quote",
    });
    const shares = toDecimalString(dec(q.qty), found.asset.decimals);
    return {
      ok: true,
      shares,
      priceUsd: q.price,
      feeUsd: q.fee,
      totalUsd: toDecimalString(dec(amount) + dec(q.fee), 6),
      minQtyOut: minAccepted(shares, found.asset.decimals),
      quotedAt: Date.now(),
    };
  } catch (err) {
    return fail(err, "quote", ctx);
  }
}

/** What selling would give right now. Signs nothing. */
export async function quoteSellAction(input: {
  assetId: string;
  qty: string;
}): Promise<SellQuote> {
  const p = z.object({ assetId: Id, qty: Money }).safeParse(input);
  if (!p.success)
    return { ok: false, message: "Something in the form looks wrong." };
  let ctx: OrderCtx = null;
  try {
    const { engine, user, found } = await context(p.data.assetId);
    if (found)
      ctx = {
        side: "sell",
        ticker: found.asset.ticker,
        chain: found.asset.chain,
      };
    if (!found?.asset.priceUsd)
      return { ok: false, message: "That asset can't be sold right now." };
    const { asset } = found;
    const qty = p.data.qty.trim();
    const problem = checkSellQty(
      qty,
      asset.free,
      asset.decimals,
      asset.priceUsd!,
      asset.ticker,
      minOrderUsd(asset),
    );
    if (problem) return { ok: false, message: problem };
    const q = await engine.client.quote(user.gatewayUserId, {
      asset_id: asset.assetId,
      side: "sell",
      qty,
      qty_unit: "base",
    });
    const proceeds = toDecimalString(dec(q.notional) - dec(q.fee), 6);
    return {
      ok: true,
      proceedsUsd: proceeds,
      priceUsd: q.price,
      feeUsd: q.fee,
      minQtyOut: minAccepted(proceeds, 6),
      quotedAt: Date.now(),
    };
  } catch (err) {
    return fail(err, "quote", ctx);
  }
}

const BuyInput = z.object({
  assetId: Id,
  amount: Money,
  minQtyOut: Money,
  lock: z
    .object({
      days: z.number().int().min(7).max(1000),
      goalName: z.string().max(40),
    })
    .nullable(),
});

/**
 * Buys through the SigningGuard: locks, limits and the price check all apply
 * before anything is signed. Optionally locks the shares straight after.
 */
export async function buyAction(
  input: z.input<typeof BuyInput>,
): Promise<TradeResult> {
  const p = BuyInput.safeParse(input);
  if (!p.success)
    return { ok: false, message: "Something in the form looks wrong." };
  const { amount, minQtyOut, lock } = p.data;
  let ctx: OrderCtx = null;
  try {
    const { engine, user, found } = await context(p.data.assetId);
    if (found)
      ctx = {
        side: "buy",
        ticker: found.asset.ticker,
        chain: found.asset.chain,
      };
    if (!found?.paying || found.asset.tradability === "sell_only")
      return { ok: false, message: "That asset can't be bought right now." };
    const problem = checkBuyAmount(
      amount.trim(),
      found.paying.free,
      minOrderUsd(found.asset),
    );
    if (problem) return { ok: false, message: problem };

    const outcome = await engine.guard.placeMarketOrder(user, {
      asset: found.raw,
      side: "buy",
      amount: amount.trim(),
      actor: "user",
      minQtyOut,
    });
    if (outcome.status === "blocked")
      return {
        ok: true,
        outcome: "blocked",
        reasons: outcome.violations.map((v) => v.message),
      };
    if (outcome.status === "not_created")
      return {
        ok: false,
        message: `${outcome.issues.join("; ") || "True Markets didn't accept the order"}. Nothing was bought.`,
      };

    const order = outcome.result;
    const status =
      order.status === "complete"
        ? "complete"
        : order.status === "failed"
          ? "failed"
          : "pending";
    const bought = toDecimalString(
      dec(order.executed_qty ?? "0"),
      found.asset.decimals,
    );
    if (status !== "complete" || !lock || dec(bought) === 0n)
      return { ok: true, outcome: "done", status, qty: bought, lock: null };

    // Buy and lock: the shares are in the wallet now, so lock exactly what arrived.
    const now = new Date();
    const unlockAt = unlockFromPreset(lock.days, now);
    const dateProblem = checkUnlockDate(unlockAt, now);
    if (dateProblem)
      return {
        ok: true,
        outcome: "done",
        status,
        qty: bought,
        lock: null,
        lockError: dateProblem,
      };
    try {
      const created = await createLock(
        { client: engine.client, store: engine.store, now: () => now },
        user.gatewayUserId,
        {
          userId: user.id,
          assetId: found.asset.assetId,
          symbol: found.asset.symbol,
          amount: bought,
          unlockAt,
          goalName:
            lock.goalName.trim() ||
            `${found.asset.ticker} until ${formatDate(unlockAt)}`,
        },
      );
      return {
        ok: true,
        outcome: "done",
        status,
        qty: bought,
        lock: { id: created.id, unlockAt: unlockAt.toISOString() },
      };
    } catch (err) {
      const message =
        err instanceof LockError
          ? err.message
          : "The shares were bought, but locking them failed. Lock them from the Vault.";
      return {
        ok: true,
        outcome: "done",
        status,
        qty: bought,
        lock: null,
        lockError: message,
      };
    }
  } catch (err) {
    return fail(err, "trade", ctx);
  }
}

const SellInput = z.object({ assetId: Id, qty: Money, minQtyOut: Money });

/** Sells free shares through the SigningGuard; locked shares are refused. */
export async function sellAction(
  input: z.input<typeof SellInput>,
): Promise<TradeResult> {
  const p = SellInput.safeParse(input);
  if (!p.success)
    return { ok: false, message: "Something in the form looks wrong." };
  let ctx: OrderCtx = null;
  try {
    const { engine, user, found } = await context(p.data.assetId);
    if (found)
      ctx = {
        side: "sell",
        ticker: found.asset.ticker,
        chain: found.asset.chain,
      };
    if (!found?.asset.priceUsd)
      return { ok: false, message: "That asset can't be sold right now." };
    const qty = p.data.qty.trim();
    const outcome = await engine.guard.placeMarketOrder(user, {
      asset: found.raw,
      side: "sell",
      amount: qty,
      actor: "user",
      minQtyOut: p.data.minQtyOut,
    });
    if (outcome.status === "blocked")
      return {
        ok: true,
        outcome: "blocked",
        reasons: outcome.violations.map((v) => v.message),
      };
    if (outcome.status === "not_created")
      return {
        ok: false,
        message: `${outcome.issues.join("; ") || "True Markets didn't accept the order"}. Nothing was sold.`,
      };
    const order = outcome.result;
    return {
      ok: true,
      outcome: "done",
      status:
        order.status === "complete"
          ? "complete"
          : order.status === "failed"
            ? "failed"
            : "pending",
      qty: formatQty(order.executed_qty ?? qty, found.asset.decimals).replace(
        /,/g,
        "",
      ),
    };
  } catch (err) {
    return fail(err, "trade", ctx);
  }
}

function fail(err: unknown, stage: "quote" | "trade", ctx: OrderCtx): Fail {
  const engine = getEngine();
  if (isGatewayError(err) && err.status >= 400 && err.status < 500) {
    // A 4xx is a refusal: nothing was traded. Plain words for people; True Markets'
    // own facts (code, message, metadata) under "Details" and in the server log.
    const refusal = {
      type: err.type,
      code: err.code,
      message: err.message,
      metadata: err.metadata,
      fieldViolations: err.fieldViolations,
    };
    const { message, detail } = describeOrderRefusal(
      refusal,
      ctx ?? { side: "buy", ticker: "this asset", chain: null },
    );
    console.warn(
      `[invest] True Markets refused the ${stage} (HTTP ${err.status}) ${detail} request_id=${err.requestId ?? "?"}`,
    );
    const general = message.startsWith("True Markets declined");
    return {
      ok: false,
      message:
        general && stage === "quote"
          ? "True Markets couldn't quote that right now. Try again."
          : message,
      requestId: err.requestId,
      detail,
    };
  }
  const f = gatewayFailure(engine, err); // rethrows anything unexpected, including redirects
  if (stage === "quote") {
    return {
      ok: false,
      message:
        f.reason === "gateway_unreachable"
          ? "We couldn't reach the market. Try again in a moment."
          : "Something went wrong. Try again.",
      requestId: f.requestId,
    };
  }
  // The order may have been submitted before the failure, so its outcome is unknown: never retry blindly.
  return {
    ok: false,
    message:
      "We couldn't confirm the order. It hasn't been retried, so check Activity before trying again.",
    requestId: f.requestId,
  };
}

/** Candles for the asset page's range tabs. Public market data; returns null when there's none. */
export async function chartAction(input: {
  assetId: string;
  range: string;
}): Promise<ChartData | null> {
  if (!Id.safeParse(input.assetId).success || !isChartRange(input.range))
    return null;
  const engine = getEngine();
  await getCurrentUser(engine); // signed-in users only
  const asset = await findInvestable(engine, input.assetId);
  return asset ? loadChart(engine, asset, input.range) : null;
}
