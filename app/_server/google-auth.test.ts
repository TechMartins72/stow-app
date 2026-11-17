import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { finishGoogleSignIn, googleConfig, startGoogleSignIn, type GoogleConfig } from "./google-auth";

const config: GoogleConfig = { clientId: "client-123.apps.googleusercontent.com", clientSecret: "test-secret" };
const redirectUri = "https://stow.example/auth/google/callback";
const now = new Date("2026-11-16T12:00:00Z");
const nowS = Math.floor(now.getTime() / 1000);

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
/** An ID token as Google's token endpoint returns it (signature not checked; see google-auth.ts). */
const idToken = (claims: Record<string, unknown>) => `${b64({ alg: "RS256" })}.${b64(claims)}.sig`;
const goodClaims = (nonce: string) => ({
  iss: "https://accounts.google.com",
  aud: config.clientId,
  exp: nowS + 3600,
  iat: nowS,
  nonce,
  email: "Ada@Example.com",
  email_verified: true,
});

/** A fake Google token endpoint returning `claims` in the ID token. */
function google(claims: Record<string, unknown> | null, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(claims ? { id_token: idToken(claims), access_token: "a" } : { error: "invalid_grant" }), { status }));
}

describe("googleConfig", () => {
  it("is off unless both the client id and secret are set", () => {
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: "x" })).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: " x ", GOOGLE_CLIENT_SECRET: "y" })).toEqual({ clientId: "x", clientSecret: "y" });
  });
});

describe("startGoogleSignIn", () => {
  const start = startGoogleSignIn(config, redirectUri);
  const url = new URL(start.url);

  it("sends people to Google asking only for their email, with a fresh state, nonce and PKCE challenge", () => {
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email",
      state: start.state,
      nonce: start.nonce,
      code_challenge_method: "S256",
    });
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(start.verifier).digest("base64url"));
    expect(start.url).not.toContain(config.clientSecret);
  });

  it("never reuses its random values", () => {
    const again = startGoogleSignIn(config, redirectUri);
    expect(again.state).not.toBe(start.state);
    expect(again.nonce).not.toBe(start.nonce);
    expect(again.verifier).not.toBe(start.verifier);
    expect(start.state.length).toBeGreaterThanOrEqual(32);
  });
});

describe("finishGoogleSignIn", () => {
  const pending = { state: "state-abc", verifier: "verifier-xyz", nonce: "nonce-123" };
  const finish = (over: Partial<Parameters<typeof finishGoogleSignIn>[0]> = {}) =>
    finishGoogleSignIn({ config, redirectUri, query: { code: "code-1", state: pending.state }, pending, now, fetchImpl: google(goodClaims(pending.nonce)), ...over });

  it("signs in with the verified, normalised email", async () => {
    await expect(finish()).resolves.toEqual({ ok: true, email: "ada@example.com" });
  });

  it("exchanges the code with the secret and the PKCE verifier, server to server", async () => {
    const fetchImpl = google(goodClaims(pending.nonce));
    await finish({ fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      code: "code-1",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: pending.verifier,
    });
  });

  it("refuses when this browser didn't start the sign-in, or the state doesn't match (forged callback)", async () => {
    await expect(finish({ pending: null })).resolves.toEqual({ ok: false, reason: "expired" });
    await expect(finish({ query: { code: "code-1", state: "someone-else" } })).resolves.toEqual({ ok: false, reason: "forged" });
    await expect(finish({ query: { code: "code-1" } })).resolves.toEqual({ ok: false, reason: "forged" });
  });

  it("treats 'cancel' on Google's screen as cancelled, not as an error", async () => {
    await expect(finish({ query: { error: "access_denied", state: pending.state } })).resolves.toEqual({ ok: false, reason: "cancelled" });
  });

  it("refuses when Google won't exchange the code", async () => {
    await expect(finish({ fetchImpl: google(null, 400) })).resolves.toEqual({ ok: false, reason: "google_error" });
    await expect(finish({ fetchImpl: vi.fn(async () => Promise.reject(new TypeError("fetch failed"))) })).resolves.toEqual({ ok: false, reason: "unreachable" });
  });

  it("refuses an ID token meant for another app, from another issuer, expired, or replayed", async () => {
    const bad = async (claims: Record<string, unknown>) => (await finish({ fetchImpl: google({ ...goodClaims(pending.nonce), ...claims }) })).ok;
    expect(await bad({ aud: "another-app" })).toBe(false);
    expect(await bad({ iss: "https://evil.example" })).toBe(false);
    expect(await bad({ exp: nowS - 1 })).toBe(false);
    expect(await bad({ nonce: "an-old-nonce" })).toBe(false);
    expect(await bad({ iss: "accounts.google.com" })).toBe(true); // Google uses both spellings
  });

  it("refuses an email Google hasn't verified, or none at all", async () => {
    const result = async (claims: Record<string, unknown>) => finish({ fetchImpl: google({ ...goodClaims(pending.nonce), ...claims }) });
    await expect(result({ email_verified: false })).resolves.toEqual({ ok: false, reason: "unverified_email" });
    await expect(result({ email_verified: "true" })).resolves.toEqual({ ok: false, reason: "unverified_email" });
    await expect(result({ email: undefined })).resolves.toEqual({ ok: false, reason: "unverified_email" });
  });

  it("refuses a malformed ID token", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id_token: "not-a-jwt" })));
    await expect(finish({ fetchImpl })).resolves.toEqual({ ok: false, reason: "google_error" });
  });
});
