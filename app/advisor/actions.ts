"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { dec, toDecimalString } from "@/engine/decimal";
import { createLock, isGatewayError, LockError } from "@/engine";
import { PROFILES, type RiskProfile } from "@/app/_lib/advisor";
import { formatDate, formatQty } from "@/app/_lib/format";
import { unlockFromPreset } from "@/app/_lib/lock-policy";
import { minAccepted } from "@/app/_lib/trade-policy";
import { computeSuggestions, getAdvisorEnabled, setAdvisorEnabled, setProfile } from "@/app/_server/advisor";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";

export type ApproveResult =
  | { ok: true; message: string; href?: string; linkLabel?: string }
  | { ok: false; blocked?: boolean; message: string; requestId?: string };

export async function setProfileAction(profile: RiskProfile): Promise<void> {
  if (!PROFILES.some((p) => p.value === profile)) return;
  const user = await getCurrentUser(getEngine());
  await setProfile(user.id, profile);
  refresh();
}

export async function setAdvisorEnabledAction(enabled: boolean): Promise<void> {
  if (typeof enabled !== "boolean") return;
  const user = await getCurrentUser(getEngine());
  await setAdvisorEnabled(user.id, enabled);
  refresh();
}

/**
 * Carries out one suggestion. The suggestion is rebuilt here from live data;
 * the id from the browser only says which one. Money moves only through the
 * SigningGuard, as the "advisor" actor, under the user's own locks and limits.
 */
export async function approveSuggestionAction(id: string): Promise<ApproveResult> {
  if (!z.string().min(1).max(200).safeParse(id).success) return { ok: false, message: "Unknown suggestion." };
  const engine = getEngine();
  try {
    const user = await getCurrentUser(engine);
    // Checked on the server, so a stale page can't approve anything once it's off.
    if (!(await getAdvisorEnabled(user.id))) return { ok: false, message: "The Advisor is switched off. Turn it on to approve suggestions." };
    const { suggestions, catalog } = await computeSuggestions(engine, user);
    const s = suggestions.find((x) => x.id === id);
    if (!s) return { ok: false, message: "That suggestion no longer applies. Your balances changed since it was made." };
    const asset = "assetId" in s.action ? catalog.find((a) => a.id === (s.action as { assetId: string }).assetId) : undefined;

    switch (s.action.kind) {
      case "lock": {
        const now = new Date();
        const unlockAt = unlockFromPreset(s.action.days, now);
        const lock = await createLock({ client: engine.client, store: engine.store, now: () => now }, user.gatewayUserId, {
          userId: user.id,
          assetId: s.action.assetId,
          symbol: asset?.symbol ?? "USDC",
          amount: s.action.amount,
          unlockAt,
          goalName: "Advisor: rainy-day lock",
        });
        refresh();
        return { ok: true, message: `Locked ${formatQty(lock.amount)} ${lock.symbol} until ${formatDate(unlockAt)}.`, href: `/vault/${lock.id}`, linkLabel: "View lock" };
      }
      case "sell":
      case "buy": {
        if (!asset) return { ok: false, message: "That asset isn't available right now." };
        const side = s.action.kind;
        const amount = side === "sell" ? s.action.qty : s.action.amountUsd;
        // Same protection as a manual trade: re-quote and refuse if the price moved more than 1%.
        const q = await engine.client.quote(user.gatewayUserId, {
          asset_id: asset.id,
          side,
          qty: amount,
          qty_unit: side === "buy" ? "quote" : "base",
        });
        const expected = side === "buy" ? toDecimalString(dec(q.qty), asset.decimals ?? 8) : toDecimalString(dec(q.notional) - dec(q.fee), 6);
        const outcome = await engine.guard.placeMarketOrder(user, {
          asset,
          side,
          amount,
          actor: "advisor",
          minQtyOut: minAccepted(expected, side === "buy" ? (asset.decimals ?? 8) : 6),
        });
        if (outcome.status === "blocked") return { ok: false, blocked: true, message: outcome.violations[0]?.message ?? "A rule said no." };
        if (outcome.status === "not_created") return { ok: false, message: `${outcome.issues.join("; ") || "True Markets didn't accept the order"}. Nothing was traded.` };
        refresh();
        const done = outcome.result.status === "complete";
        return {
          ok: true,
          message: done ? `${side === "buy" ? "Bought" : "Sold"} for you, under your rules.` : "Order placed; confirming.",
          href: "/activity",
          linkLabel: "View activity",
        };
      }
      default:
        return { ok: false, message: "This suggestion has nothing to approve." };
    }
  } catch (err) {
    if (err instanceof LockError) return { ok: false, message: err.message };
    if (isGatewayError(err) && err.status >= 400 && err.status < 500) return { ok: false, message: "True Markets declined it. Nothing was traded.", requestId: err.requestId };
    const f = gatewayFailure(engine, err);
    return { ok: false, message: "We couldn't confirm it. It hasn't been retried, so check Activity before trying again.", requestId: f.requestId };
  }
}
