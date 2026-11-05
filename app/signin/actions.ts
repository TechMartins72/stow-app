"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { requestLoginLink, signInWithToken, signOut, startSession } from "@/app/_server/auth-core";
import { sendSignInEmail } from "@/app/_server/email";
import { appUrl, getAuthStore, setSessionCookie, takeSessionCookie } from "@/app/_server/session";

export type LinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

/** Emails a one-time sign-in link. Says "sent" whether or not the address has an account. */
export async function requestLinkAction(_prev: LinkState, form: FormData): Promise<LinkState> {
  const raw = String(form.get("email") ?? "");
  const result = await requestLoginLink(getAuthStore(), raw, new Date());
  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "invalid_email"
          ? "That doesn't look like an email address."
          : "Too many links requested for this address. Wait 15 minutes and try again.",
    };
  }
  const url = `${appUrl()}/auth/verify?token=${encodeURIComponent(result.token)}`;
  const sent = await sendSignInEmail(result.email, url);
  if (!sent.ok) return { status: "error", message: "We couldn't send the email just now. Please try again in a minute." };
  return { status: "sent", email: result.email };
}

/**
 * The link's landing page posts here, so email scanners that open links
 * can't use up the token. Success sets the session cookie and goes Home.
 */
export async function verifyLinkAction(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const result = token ? await signInWithToken(getAuthStore(), token, new Date()) : { ok: false as const };
  if (!result.ok) redirect("/auth/verify?error=expired");
  await setSessionCookie(result.sessionToken);
  redirect("/");
}

/** Practice mode only: a fresh demo account with practice money, no email needed. */
export async function demoSignInAction(): Promise<void> {
  if (process.env.GATEWAY_MODE === "live") redirect("/signin");
  const store = getAuthStore();
  const user = await store.upsertUser(`demo-${randomBytes(5).toString("hex")}@demo.invalid`);
  await setSessionCookie(await startSession(store, user.id, new Date()));
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const token = await takeSessionCookie();
  if (token) await signOut(getAuthStore(), token);
  redirect("/signin");
}
