"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createLock, LockError, type Tranche } from "@/engine";
import { checkGoalName, checkLockAmount, checkUnlockDate, planSchedule } from "@/app/_lib/lock-policy";
import { getCurrentUser, getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { loadLockable } from "@/app/_server/wallet";

const Unlock = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("once"), unlockAt: z.iso.datetime() }),
  z.object({
    kind: z.literal("parts"),
    firstAt: z.iso.datetime(),
    every: z.enum(["week", "2weeks", "month"]),
    split: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("percent"), percent: z.string().regex(/^\d+(\.\d+)?$/) }),
      z.object({ kind: z.literal("fixed"), amount: z.string().regex(/^\d+(\.\d+)?$/) }),
    ]),
  }),
]);

const Input = z.object({
  assetId: z.string().min(1),
  amount: z.string(),
  unlock: Unlock,
  goalName: z.string(),
});

export type CreateLockInput = z.input<typeof Input>;
export type CreateLockResult = { ok: false; message: string; requestId?: string };

/**
 * Creates a lock. Moves no funds: it records an amount the SigningGuard will
 * refuse to sign away until each part's date. On success, redirects to Home.
 * The schedule is rebuilt here from the user's choices; the browser's copy is
 * only a preview.
 */
export async function createLockAction(raw: CreateLockInput): Promise<CreateLockResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Something in the form looks wrong. Please check it and try again." };
  const input = parsed.data;
  const now = new Date();

  const engine = getEngine();
  let lockId: string;
  try {
    const user = await getCurrentUser(engine);
    const asset = (await loadLockable(engine, user)).find((a) => a.assetId === input.assetId);
    if (!asset) return { ok: false, message: "That asset has nothing left to lock." };
    const amount = input.amount.trim();

    const problem = checkLockAmount(amount, asset.accessible, asset.decimals) ?? checkGoalName(input.goalName);
    if (problem) return { ok: false, message: problem };

    let unlockAt: Date;
    let schedule: Tranche[] | undefined;
    if (input.unlock.kind === "once") {
      unlockAt = new Date(input.unlock.unlockAt);
      const dateProblem = checkUnlockDate(unlockAt, now);
      if (dateProblem) return { ok: false, message: dateProblem };
    } else {
      const plan = planSchedule(
        {
          stable: asset.stable,
          total: amount,
          decimals: asset.decimals,
          firstAt: new Date(input.unlock.firstAt),
          every: input.unlock.every,
          split: input.unlock.split,
        },
        now,
      );
      if ("error" in plan) return { ok: false, message: plan.error };
      schedule = plan.schedule;
      unlockAt = schedule.at(-1)!.releaseAt;
    }

    const lock = await createLock({ client: engine.client, store: engine.store, now: () => now }, user.gatewayUserId, {
      userId: user.id,
      assetId: asset.assetId,
      symbol: asset.symbol,
      amount,
      unlockAt,
      schedule,
      goalName: input.goalName.trim(),
    });
    lockId = lock.id;
  } catch (err) {
    if (err instanceof LockError) return { ok: false, message: err.message };
    const failure = gatewayFailure(engine, err);
    return {
      ok: false,
      message:
        failure.reason === "gateway_unreachable"
          ? "We couldn't reach your wallet. Nothing was locked; please try again."
          : "Something went wrong and nothing was locked. Please try again.",
      requestId: failure.requestId,
    };
  }
  redirect(`/?locked=${encodeURIComponent(lockId)}`);
}
