// When an account may be deleted. Deleting removes Stow's link to the person's True
// Markets wallets (True Markets has no API to close them), so after deletion nobody
// can sign for that money again. So: never while anything is locked (deleting must not
// be a way round a plan), withdraw anything worth $1 or more first, and say plainly
// what's left behind below that. Shared by the page and the server action.

import { dec, mul, sum, toDecimalString, ZERO } from "@/engine/decimal";

/** Below this, leftovers may be left behind (with the person's say-so). */
export const LEFTOVER_LIMIT_USD = "1";
/** Deleting needs a sign-in this recent, so a borrowed signed-in phone can't do it. */
export const RECENT_SIGN_IN_MS = 15 * 60_000;

export interface DeletionHolding {
  assetId: string;
  symbol: string;
  chain: string | null;
  /** In the wallet (includes the locked part). */
  available: string;
  /** Held by plans right now. */
  locked: string;
  /** "0" when unknown. */
  priceUsd: string;
  blockers: {
    goalName: string;
    lockedAmount: string;
    nextReleaseAt: Date | null;
  }[];
}

export type DeletionCheck =
  | {
      ok: false;
      reason: "locked";
      plans: {
        goalName: string;
        symbol: string;
        amount: string;
        until: Date | null;
      }[];
    }
  | {
      ok: false;
      reason: "withdraw_first";
      /** `valueUsd` is null when the coin can't be priced. */
      holdings: {
        assetId: string;
        symbol: string;
        chain: string | null;
        available: string;
        valueUsd: string | null;
      }[];
      totalUsd: string;
    }
  | { ok: true; leftoverUsd: string };

export function deletionCheck(holdings: DeletionHolding[]): DeletionCheck {
  const plans = holdings.flatMap((h) =>
    dec(h.locked) > ZERO
      ? h.blockers.map((b) => ({
          goalName: b.goalName,
          symbol: h.symbol,
          amount: b.lockedAmount,
          until: b.nextReleaseAt,
        }))
      : [],
  );
  if (plans.length > 0) return { ok: false, reason: "locked", plans };

  const held = holdings
    .filter((h) => dec(h.available) > ZERO)
    .map((h) => {
      const priced = dec(h.priceUsd) > ZERO;
      return {
        h,
        value: priced ? mul(dec(h.available), dec(h.priceUsd)) : null,
      };
    });
  const total = sum(held.map((x) => x.value ?? ZERO));
  const unpriced = held.some((x) => x.value === null);

  if (unpriced || total >= dec(LEFTOVER_LIMIT_USD)) {
    return {
      ok: false,
      reason: "withdraw_first",
      holdings: held.map(({ h, value }) => ({
        assetId: h.assetId,
        symbol: h.symbol,
        chain: h.chain,
        available: h.available,
        valueUsd: value === null ? null : toDecimalString(value, 2),
      })),
      totalUsd: toDecimalString(total, 2),
    };
  }
  return { ok: true, leftoverUsd: toDecimalString(total, 2) };
}

export function signedInRecently(signedInAt: Date, now: Date): boolean {
  return now.getTime() - signedInAt.getTime() <= RECENT_SIGN_IN_MS;
}

export function confirmsEmail(typed: string, email: string): boolean {
  return (
    typed.trim().toLowerCase() === email.trim().toLowerCase() &&
    typed.trim() !== ""
  );
}
