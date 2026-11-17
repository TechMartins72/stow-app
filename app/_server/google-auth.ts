// "Continue with Google": OpenID Connect authorization-code flow with PKCE.
// Framework-free so every refusal is testable; the route handlers in
// app/auth/google/ only move cookies and redirects around it.
//
// We ask Google for the email only. Accounts are keyed by email, so signing in
// with Google finds the same account (and wallets) as an email link would.
//
// The ID token comes straight from Google's token endpoint over TLS, in exchange
// for a one-time code plus our client secret and PKCE verifier. OpenID Connect
// Core 3.1.3.7 lets TLS stand in for checking its signature in that case; we
// still check who issued it, who it's for, that it's fresh, and the nonce.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { normaliseEmail } from "./auth-core";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

/** What this browser must remember between leaving for Google and coming back. */
export interface PendingGoogleSignIn {
  state: string;
  verifier: string;
  nonce: string;
}

export type GoogleSignInResult =
  | { ok: true; email: string }
  | { ok: false; reason: "expired" | "forged" | "cancelled" | "google_error" | "unreachable" | "unverified_email" };

/** Short-lived, httpOnly cookie holding a PendingGoogleSignIn, scoped to /auth/google. */
export const GOOGLE_PENDING_COOKIE = "pv_google";
/** Must match an "Authorized redirect URI" on the Google Cloud OAuth client exactly. */
export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

/** Google sign-in is on only when both values are set. */
export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

const random = () => randomBytes(32).toString("base64url");

export function startGoogleSignIn(config: GoogleConfig, redirectUri: string): PendingGoogleSignIn & { url: string } {
  const pending = { state: random(), verifier: random(), nonce: random() };
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: createHash("sha256").update(pending.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { ...pending, url: url.toString() };
}

export async function finishGoogleSignIn(input: {
  config: GoogleConfig;
  redirectUri: string;
  /** The callback's query string. */
  query: { code?: string; state?: string; error?: string };
  /** From this browser's cookie; null if it's missing or expired. */
  pending: PendingGoogleSignIn | null;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<GoogleSignInResult> {
  const { config, redirectUri, query, pending, now, fetchImpl = fetch } = input;
  if (!pending) return { ok: false, reason: "expired" };
  if (!query.state || !sameString(query.state, pending.state)) return { ok: false, reason: "forged" };
  if (query.error) return { ok: false, reason: query.error === "access_denied" ? "cancelled" : "google_error" };
  if (!query.code) return { ok: false, reason: "google_error" };

  let res: Response;
  try {
    res = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: query.code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: pending.verifier,
      }).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!res.ok) return { ok: false, reason: "google_error" };

  const claims = idTokenClaims(((await res.json().catch(() => null)) as { id_token?: unknown } | null)?.id_token);
  if (!claims) return { ok: false, reason: "google_error" };
  const fresh = typeof claims.exp === "number" && claims.exp * 1000 > now.getTime();
  const ours = claims.aud === config.clientId && typeof claims.iss === "string" && ISSUERS.has(claims.iss);
  const nonceOk = typeof claims.nonce === "string" && sameString(claims.nonce, pending.nonce);
  if (!fresh || !ours || !nonceOk) return { ok: false, reason: "google_error" };

  // Only an address Google has confirmed belongs to this person may open an account.
  const email = claims.email_verified === true && typeof claims.email === "string" ? normaliseEmail(claims.email) : null;
  if (!email) return { ok: false, reason: "unverified_email" };
  return { ok: true, email };
}

/** The ID token's payload, or null if it isn't a well-formed JWT. */
function idTokenClaims(token: unknown): Record<string, unknown> | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Pending sign-in, as stored in its short-lived cookie. */
export function encodePending(p: PendingGoogleSignIn): string {
  return Buffer.from(JSON.stringify(p)).toString("base64url");
}

export function decodePending(raw: string | undefined): PendingGoogleSignIn | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return typeof p?.state === "string" && typeof p?.verifier === "string" && typeof p?.nonce === "string" ? p : null;
  } catch {
    return null;
  }
}
