import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { startSession } from "@/app/_server/auth-core";
import { flash } from "@/app/_server/flash";
import {
  decodePending,
  finishGoogleSignIn,
  GOOGLE_CALLBACK_PATH,
  GOOGLE_PENDING_COOKIE,
  googleConfig,
  type GoogleSignInResult,
} from "@/app/_server/google-auth";
import { appUrl, getAuthStore, setSessionCookie } from "@/app/_server/session";

const PROBLEM: Record<Exclude<GoogleSignInResult, { ok: true }>["reason"], { title: string; body?: string }> = {
  cancelled: { title: "Sign-in cancelled" },
  expired: { title: "That sign-in took too long", body: "Please try again." },
  forged: { title: "We couldn't confirm that sign-in", body: "Please start again from this page." },
  google_error: { title: "Google didn't confirm the sign-in", body: "Please try again, or use the email link." },
  unreachable: { title: "We couldn't reach Google", body: "Check your connection and try again." },
  unverified_email: { title: "Your Google email isn't verified", body: "Verify it with Google, or use the email link." },
};

/** Google sends people back here. Signs them in by their verified email, or explains what went wrong. */
export async function GET(request: NextRequest) {
  const jar = await cookies();
  const pending = decodePending(jar.get(GOOGLE_PENDING_COOKIE)?.value);
  jar.delete({ name: GOOGLE_PENDING_COOKIE, path: "/auth/google" }); // one use only

  const config = googleConfig();
  const q = request.nextUrl.searchParams;
  const result: GoogleSignInResult = config
    ? await finishGoogleSignIn({
        config,
        redirectUri: appUrl() + GOOGLE_CALLBACK_PATH,
        query: { code: q.get("code") ?? undefined, state: q.get("state") ?? undefined, error: q.get("error") ?? undefined },
        pending,
        now: new Date(),
      })
    : { ok: false, reason: "google_error" };

  if (!result.ok) {
    const problem = PROBLEM[result.reason];
    await flash({ tone: result.reason === "cancelled" ? "info" : "error", ...problem });
    redirect("/signin");
  }

  // Same account as an email link for this address: accounts are keyed by email.
  const store = getAuthStore();
  const user = await store.upsertUser(result.email);
  await setSessionCookie(await startSession(store, user.id, new Date()));
  await flash({ tone: "success", title: "You're signed in" });
  redirect("/");
}
