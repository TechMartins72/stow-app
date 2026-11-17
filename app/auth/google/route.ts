import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encodePending, GOOGLE_CALLBACK_PATH, GOOGLE_PENDING_COOKIE, googleConfig, startGoogleSignIn } from "@/app/_server/google-auth";
import { appUrl } from "@/app/_server/session";
import { flash } from "@/app/_server/flash";

/** "Continue with Google": remembers this browser's state, nonce and PKCE verifier, then goes to Google. */
export async function GET() {
  const config = googleConfig();
  if (!config) {
    await flash({ tone: "error", title: "Google sign-in isn't set up yet", body: "Use the email link for now." });
    redirect("/signin");
  }
  const start = startGoogleSignIn(config, appUrl() + GOOGLE_CALLBACK_PATH);
  (await cookies()).set(GOOGLE_PENDING_COOKIE, encodePending(start), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sent on Google's redirect back, which is a top-level GET
    path: "/auth/google",
    maxAge: 10 * 60,
  });
  redirect(start.url);
}
