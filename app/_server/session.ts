import "server-only";

import { cookies } from "next/headers";
import { DrizzleAuthStore } from "@/db/auth-store";
import { MemoryAuthStore, SESSION_TTL_MS, sessionUser, type AuthStore, type SessionUser } from "./auth-core";
import { getDb, retryReadIfDbStuck } from "./engine";

export const SESSION_COOKIE = "pv_session";

const g = globalThis as typeof globalThis & { __memoryAuth?: MemoryAuthStore };

export function getAuthStore(): AuthStore {
  const db = getDb();
  if (db) return new DrizzleAuthStore(db);
  return (g.__memoryAuth ??= new MemoryAuthStore());
}

/** The signed-in user from the session cookie, or null. */
export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Every signed-in page reads the session first, so a stuck pool is noticed (and replaced) here.
  return retryReadIfDbStuck(() => sessionUser(getAuthStore(), token, new Date()));
}

/** Only in Server Functions or Route Handlers: cookies can't be set while rendering. */
export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function takeSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  return token;
}

/** Where sign-in links point. From config, never from the request's Host header. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
