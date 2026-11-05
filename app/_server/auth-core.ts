// Passwordless sign-in: emailed one-time links and cookie sessions.
// Framework-free so the rules are easy to test; storage sits behind AuthStore.
// Raw tokens only ever live in the email and the cookie; we store SHA-256s.

import { createHash, randomBytes, randomUUID } from "node:crypto";

export const LINK_TTL_MS = 15 * 60_000;
export const SESSION_TTL_MS = 30 * 24 * 3_600_000;
export const MAX_LINKS_PER_WINDOW = 5;
const RATE_WINDOW_MS = 15 * 60_000;

export interface SessionUser {
  userId: string;
  email: string;
  gatewayUserId: string | null;
}

export interface AuthStore {
  countLoginTokensSince(email: string, since: Date): Promise<number>;
  insertLoginToken(row: { tokenHash: string; email: string; createdAt: Date; expiresAt: Date }): Promise<void>;
  /** Marks the token used and returns its email, only if unused and unexpired. Must be atomic. */
  consumeLoginToken(tokenHash: string, now: Date): Promise<{ email: string } | null>;
  upsertUser(email: string): Promise<{ id: string }>;
  insertSession(row: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void>;
  findSession(tokenHash: string, now: Date): Promise<SessionUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

/** Lowercased, trimmed address, or null when it can't be one. */
export function normaliseEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

export async function requestLoginLink(
  store: AuthStore,
  rawEmail: string,
  now: Date,
): Promise<{ ok: true; email: string; token: string } | { ok: false; reason: "invalid_email" | "rate_limited" }> {
  const email = normaliseEmail(rawEmail);
  if (!email) return { ok: false, reason: "invalid_email" };
  const recent = await store.countLoginTokensSince(email, new Date(now.getTime() - RATE_WINDOW_MS));
  if (recent >= MAX_LINKS_PER_WINDOW) return { ok: false, reason: "rate_limited" };

  const token = newToken();
  await store.insertLoginToken({ tokenHash: hashToken(token), email, createdAt: now, expiresAt: new Date(now.getTime() + LINK_TTL_MS) });
  return { ok: true, email, token };
}

/** Exchanges a one-time link for a session. Creates the user on first sign-in. */
export async function signInWithToken(
  store: AuthStore,
  token: string,
  now: Date,
): Promise<{ ok: true; userId: string; sessionToken: string } | { ok: false }> {
  const used = await store.consumeLoginToken(hashToken(token), now);
  if (!used) return { ok: false };
  const user = await store.upsertUser(used.email);
  return { ok: true, userId: user.id, sessionToken: await startSession(store, user.id, now) };
}

export async function startSession(store: AuthStore, userId: string, now: Date): Promise<string> {
  const sessionToken = newToken();
  await store.insertSession({ tokenHash: hashToken(sessionToken), userId, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) });
  return sessionToken;
}

export function sessionUser(store: AuthStore, sessionToken: string, now: Date): Promise<SessionUser | null> {
  return store.findSession(hashToken(sessionToken), now);
}

export function signOut(store: AuthStore, sessionToken: string): Promise<void> {
  return store.deleteSession(hashToken(sessionToken));
}

/** In-memory AuthStore for tests and for running without a database. */
export class MemoryAuthStore implements AuthStore {
  private tokens: { tokenHash: string; email: string; createdAt: Date; expiresAt: Date; usedAt?: Date }[] = [];
  private users: { id: string; email: string; gatewayUserId: string | null }[] = [];
  private sessions: { tokenHash: string; userId: string; expiresAt: Date }[] = [];

  async countLoginTokensSince(email: string, since: Date) {
    return this.tokens.filter((t) => t.email === email && t.createdAt >= since).length;
  }
  async insertLoginToken(row: { tokenHash: string; email: string; createdAt: Date; expiresAt: Date }) {
    this.tokens.push({ ...row });
  }
  async consumeLoginToken(tokenHash: string, now: Date) {
    const t = this.tokens.find((x) => x.tokenHash === tokenHash && !x.usedAt && x.expiresAt > now);
    if (!t) return null;
    t.usedAt = now;
    return { email: t.email };
  }
  async upsertUser(email: string) {
    let user = this.users.find((u) => u.email === email);
    if (!user) this.users.push((user = { id: randomUUID(), email, gatewayUserId: null }));
    return { id: user.id };
  }
  async insertSession(row: { tokenHash: string; userId: string; expiresAt: Date }) {
    this.sessions.push({ ...row });
  }
  async findSession(tokenHash: string, now: Date) {
    const s = this.sessions.find((x) => x.tokenHash === tokenHash && x.expiresAt > now);
    const user = s && this.users.find((u) => u.id === s.userId);
    return user ? { userId: user.id, email: user.email, gatewayUserId: user.gatewayUserId } : null;
  }
  async deleteSession(tokenHash: string) {
    this.sessions = this.sessions.filter((s) => s.tokenHash !== tokenHash);
  }
}
