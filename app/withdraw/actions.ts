"use server";

import { z } from "zod";
import { dec, mul, toDecimalString } from "@/engine/decimal";
import { isGatewayError, type ProposedAction } from "@/engine";
import { chainFamily, checkAddress } from "@/app/_lib/address";
import { checkSendAmount } from "@/app/_lib/send-amount";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { loadHoldings, type Blocker } from "@/app/_server/wallet";

const Input = z.object({ assetId: z.string().min(1), qty: z.string(), to: z.string() });
export type WithdrawInput = z.input<typeof Input>;

export type PreviewResult =
  | { ok: false; message: string; requestId?: string }
  | { ok: true; allowed: true }
  | { ok: true; allowed: false; reasons: string[]; blockers: Blocker[]; accessible: string };

export type SendResult =
  | { ok: false; message: string; requestId?: string }
  | { ok: true; outcome: "blocked"; reasons: string[] }
  | { ok: true; outcome: "sent"; status: "completed" | "pending" | "failed"; qty: string; fee: string; txHash: string; explorerUrl: string | null };

/** Checks the form and asks the guard whether it would sign. Creates nothing, signs nothing. */
async function check(raw: WithdrawInput) {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { error: "Something in the form looks wrong. Please check it and try again." } as const;
  const { assetId, qty, to } = parsed.data;

  const engine = getEngine();
  const user = await getCurrentUser(engine);
  const holding = (await loadHoldings(engine, user)).find((h) => h.assetId === assetId);
  if (!holding) return { error: "You don't hold that asset." } as const;
  const family = chainFamily(holding.chain);
  // Crypto only for now: whether tokenized stocks may leave for outside wallets is still an open question for True Markets.
  const sendable = await engine.client.listAssets({ asset_class: "crypto" });
  if (!family || !sendable.some((a) => a.id === assetId)) return { error: `${holding.symbol} can't be sent to an outside address.` } as const;

  const problem = checkSendAmount(qty, holding.available, holding.decimals, holding.symbol) ?? checkAddress(family, to);
  if (problem) return { error: problem } as const;

  const action: ProposedAction = {
    kind: "transfer",
    actor: "user",
    assetId,
    symbol: holding.symbol,
    productType: "spot",
    debits: [{ assetId, symbol: holding.symbol, qty: qty.trim() }],
    notionalUsd: toDecimalString(mul(dec(qty.trim()), dec(holding.priceUsd)), 6),
  };
  const decision = await engine.guard.preview(user, action);
  return { engine, user, holding, qty: qty.trim(), to: to.trim(), decision } as const;
}

export async function previewWithdrawAction(raw: WithdrawInput): Promise<PreviewResult> {
  try {
    const c = await check(raw);
    if ("error" in c) return { ok: false, message: c.error! };
    if (c.decision.allowed) return { ok: true, allowed: true };
    return {
      ok: true,
      allowed: false,
      reasons: c.decision.violations.map((v) => v.message),
      blockers: c.holding.blockers,
      accessible: c.holding.accessible,
    };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Sends through the SigningGuard: it re-checks every rule against live
 * balances and locks, and only then signs. A blocked send is never signed.
 */
export async function withdrawAction(raw: WithdrawInput): Promise<SendResult> {
  try {
    const c = await check(raw);
    if ("error" in c) return { ok: false, message: c.error! };
    const { engine, user, holding, qty, to } = c;
    const asset = (await engine.client.listAssets({ asset_class: "crypto" })).find((a) => a.id === holding.assetId);
    if (!asset) return { ok: false, message: `${holding.symbol} isn't available to send right now.` };

    const outcome = await engine.guard.withdraw(user, { asset, qty, to, actor: "user" });
    if (outcome.status === "blocked") return { ok: true, outcome: "blocked", reasons: outcome.violations.map((v) => v.message) };
    if (outcome.status === "not_created") return { ok: false, message: "The network didn't accept this transfer. Nothing was sent." };

    const t = outcome.result;
    return {
      ok: true,
      outcome: "sent",
      status: t.status === "completed" ? "completed" : t.status === "failed" ? "failed" : "pending",
      qty: t.qty,
      fee: t.fee,
      txHash: t.tx_hash,
      explorerUrl: t.explorer_url ?? null,
    };
  } catch (err) {
    return failure(err);
  }
}

function failure(err: unknown): { ok: false; message: string; requestId?: string } {
  const engine = getEngine();
  if (isGatewayError(err, "insufficient_balance")) {
    return { ok: false, message: "Your wallet doesn't have enough to cover this, including fees. Nothing was sent.", requestId: err.requestId };
  }
  const f = gatewayFailure(engine, err); // rethrows anything unexpected, including redirects
  return {
    ok: false,
    message: f.reason === "gateway_unreachable" ? "We couldn't reach your wallet. Nothing was sent." : "Something went wrong. Nothing was sent.",
    requestId: f.requestId,
  };
}
