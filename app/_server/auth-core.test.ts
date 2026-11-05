import { describe, expect, it } from "vitest";
import {
  LINK_TTL_MS,
  MAX_LINKS_PER_WINDOW,
  MemoryAuthStore,
  normaliseEmail,
  requestLoginLink,
  sessionUser,
  SESSION_TTL_MS,
  signInWithToken,
  signOut,
} from "./auth-core";

const t0 = new Date("2026-11-05T12:00:00Z");
const later = (ms: number) => new Date(t0.getTime() + ms);

describe("normaliseEmail", () => {
  it("trims and lowercases a plausible address", () => {
    expect(normaliseEmail("  Sandra@Example.COM ")).toBe("sandra@example.com");
  });
  it("rejects things that aren't addresses", () => {
    expect(normaliseEmail("sandra")).toBeNull();
    expect(normaliseEmail("a@b")).toBeNull();
    expect(normaliseEmail("a b@c.com")).toBeNull();
    expect(normaliseEmail(`${"x".repeat(250)}@a.com`)).toBeNull();
  });
});

describe("magic links", () => {
  it("signs in once with a fresh link and creates the user", async () => {
    const store = new MemoryAuthStore();
    const link = await requestLoginLink(store, "Sandra@example.com", t0);
    expect(link.ok).toBe(true);
    if (!link.ok) return;

    const first = await signInWithToken(store, link.token, later(60_000));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect((await sessionUser(store, first.sessionToken, later(60_000)))?.email).toBe("sandra@example.com");

    // The same link can't be used twice.
    expect((await signInWithToken(store, link.token, later(120_000))).ok).toBe(false);
  });

  it("refuses an expired or unknown link", async () => {
    const store = new MemoryAuthStore();
    const link = await requestLoginLink(store, "sandra@example.com", t0);
    if (!link.ok) throw new Error("expected a link");
    expect((await signInWithToken(store, link.token, later(LINK_TTL_MS + 1))).ok).toBe(false);
    expect((await signInWithToken(store, "not-a-real-token", t0)).ok).toBe(false);
  });

  it("returns the same user on later sign-ins", async () => {
    const store = new MemoryAuthStore();
    const ids: string[] = [];
    for (const at of [t0, later(3_600_000)]) {
      const link = await requestLoginLink(store, "sandra@example.com", at);
      if (!link.ok) throw new Error("expected a link");
      const res = await signInWithToken(store, link.token, at);
      if (!res.ok) throw new Error("expected sign-in");
      ids.push(res.userId);
    }
    expect(ids[0]).toBe(ids[1]);
  });

  it("limits how many links one address can request", async () => {
    const store = new MemoryAuthStore();
    for (let i = 0; i < MAX_LINKS_PER_WINDOW; i++) {
      expect((await requestLoginLink(store, "sandra@example.com", later(i * 1000))).ok).toBe(true);
    }
    expect(await requestLoginLink(store, "sandra@example.com", later(10_000))).toEqual({ ok: false, reason: "rate_limited" });
    // Other addresses are unaffected, and the window moves on.
    expect((await requestLoginLink(store, "other@example.com", later(10_000))).ok).toBe(true);
    expect((await requestLoginLink(store, "sandra@example.com", later(16 * 60_000))).ok).toBe(true);
  });

  it("rejects an invalid address", async () => {
    expect(await requestLoginLink(new MemoryAuthStore(), "nope", t0)).toEqual({ ok: false, reason: "invalid_email" });
  });

  it("never stores the raw tokens", async () => {
    const store = new MemoryAuthStore();
    const link = await requestLoginLink(store, "sandra@example.com", t0);
    if (!link.ok) throw new Error("expected a link");
    const res = await signInWithToken(store, link.token, t0);
    if (!res.ok) throw new Error("expected sign-in");
    const dump = JSON.stringify(store);
    expect(dump).not.toContain(link.token);
    expect(dump).not.toContain(res.sessionToken);
  });
});

describe("sessions", () => {
  async function signedIn(store: MemoryAuthStore) {
    const link = await requestLoginLink(store, "sandra@example.com", t0);
    if (!link.ok) throw new Error("expected a link");
    const res = await signInWithToken(store, link.token, t0);
    if (!res.ok) throw new Error("expected sign-in");
    return res.sessionToken;
  }

  it("expires after the session lifetime", async () => {
    const store = new MemoryAuthStore();
    const token = await signedIn(store);
    expect(await sessionUser(store, token, later(SESSION_TTL_MS - 1))).not.toBeNull();
    expect(await sessionUser(store, token, later(SESSION_TTL_MS + 1))).toBeNull();
  });

  it("ends on sign-out", async () => {
    const store = new MemoryAuthStore();
    const token = await signedIn(store);
    await signOut(store, token);
    expect(await sessionUser(store, token, t0)).toBeNull();
  });
});
