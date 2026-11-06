"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/app/_server/current-user";
import { mockCredit } from "@/app/_server/demo-seed";
import { getEngine } from "@/app/_server/engine";

const PRACTICE_GRANT: Record<string, string> = { USDC: "100", SOL: "1" };

export type PracticeFundsResult = { ok: true; amount: string; symbol: string } | { ok: false; message: string };

/** Practice mode only: drops some fake funds into the wallet, as if someone had sent them. */
export async function addPracticeFundsAction(assetId: string): Promise<PracticeFundsResult> {
  const engine = getEngine();
  if (engine.config.mode !== "mock") return { ok: false, message: "Practice funds only exist in practice mode." };
  const user = await getCurrentUser(engine);
  const asset = (await engine.client.listAssets({ asset_class: "crypto" })).find((a) => a.id === assetId);
  const amount = asset ? PRACTICE_GRANT[asset.symbol] : undefined;
  if (!asset || !amount) return { ok: false, message: "That asset has no practice funds." };
  try {
    await mockCredit(engine, user, asset.id, amount);
  } catch {
    return { ok: false, message: "The practice wallet didn't respond. Is the mock running?" };
  }
  refresh();
  return { ok: true, amount, symbol: asset.symbol };
}
