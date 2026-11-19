"use server";

import { redirect } from "next/navigation";
import {
  confirmsEmail,
  deletionCheck,
  signedInRecently,
} from "@/app/_lib/account-deletion";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { flash } from "@/app/_server/flash";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import {
  getAuthStore,
  readSession,
  takeSessionCookie,
} from "@/app/_server/session";
import { loadHoldings } from "@/app/_server/wallet";
import { signOut } from "@/app/_server/auth-core";

export type DeleteState =
  { status: "idle" } | { status: "error"; message: string };

/**
 * Deletes the signed-in account. Every check the page showed is made again here,
 * against live balances: the page may be stale, and the browser can't be trusted.
 */
export async function deleteAccountAction(
  _prev: DeleteState,
  form: FormData,
): Promise<DeleteState> {
  const session = await readSession();
  if (!session) redirect("/signin");
  if (!signedInRecently(session.signedInAt, new Date())) {
    return {
      status: "error",
      message: "For your safety, sign in again before deleting your account.",
    };
  }
  if (!confirmsEmail(String(form.get("email") ?? ""), session.email)) {
    return {
      status: "error",
      message: "Type your email address exactly as shown to confirm.",
    };
  }

  const engine = getEngine();
  let check;
  try {
    const user = await getCurrentUser(engine);
    check = deletionCheck(await loadHoldings(engine, user));
  } catch (err) {
    gatewayFailure(engine, err); // rethrows anything unexpected, including redirects
    return {
      status: "error",
      message:
        "We couldn't check your wallets just now, so nothing was deleted. Please try again.",
    };
  }
  if (!check.ok) {
    return {
      status: "error",
      message:
        check.reason === "locked"
          ? "Some of your money is locked in a plan, so your account can't be deleted yet. Nothing was deleted."
          : "Your wallets hold $1 or more. Withdraw it first, then delete your account. Nothing was deleted.",
    };
  }
  if (check.leftoverUsd !== "0" && form.get("leftover") !== "yes") {
    return {
      status: "error",
      message:
        "Tick the box to confirm you're leaving the small amount behind.",
    };
  }

  await getAuthStore().deleteUser(session.userId, session.email);
  const token = await takeSessionCookie();
  if (token) await signOut(getAuthStore(), token); // already gone with the user; harmless
  console.info(`[account] deleted user ${session.userId}`); // Stow's random id only, never the email
  await flash({
    tone: "success",
    title: "Your account has been deleted",
    body: "Thanks for trying Stow.",
  });
  // Straight to the landing page: re-rendering this page would bounce to /signin.
  redirect("/welcome");
}

/** "Sign in again": ends this session and returns to the sign-in page. */
export async function signInAgainAction(): Promise<void> {
  const token = await takeSessionCookie();
  if (token) await signOut(getAuthStore(), token);
  await flash({
    tone: "info",
    title: "Sign in again",
    body: "Then open your profile menu and choose Delete account.",
  });
  redirect("/signin");
}
