import { and, count, eq, gt, gte, isNull, sql } from "drizzle-orm";
import type { AuthStore } from "../app/_server/auth-core";
import type { Db } from "./client";
import { loginTokens, sessions, users } from "./schema";

/** Postgres AuthStore. Token consumption is a single conditional UPDATE, so a link can't be used twice. */
export class DrizzleAuthStore implements AuthStore {
  constructor(private readonly db: Db) {}

  async countLoginTokensSince(email: string, since: Date) {
    const [row] = await this.db
      .select({ n: count() })
      .from(loginTokens)
      .where(and(eq(loginTokens.email, email), gte(loginTokens.createdAt, since)));
    return row?.n ?? 0;
  }

  async insertLoginToken(row: { tokenHash: string; email: string; createdAt: Date; expiresAt: Date }) {
    await this.db.insert(loginTokens).values(row);
  }

  async consumeLoginToken(tokenHash: string, now: Date) {
    const [row] = await this.db
      .update(loginTokens)
      .set({ usedAt: now })
      .where(and(eq(loginTokens.tokenHash, tokenHash), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, now)))
      .returning({ email: loginTokens.email });
    return row ?? null;
  }

  async upsertUser(email: string) {
    const [row] = await this.db
      .insert(users)
      .values({ email })
      .onConflictDoUpdate({ target: users.email, set: { email: sql`excluded.email` } })
      .returning({ id: users.id });
    return row;
  }

  async insertSession(row: { tokenHash: string; userId: string; expiresAt: Date }) {
    await this.db.insert(sessions).values(row);
  }

  async findSession(tokenHash: string, now: Date) {
    const [row] = await this.db
      .select({ userId: users.id, email: users.email, gatewayUserId: users.gatewayUserId })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)));
    return row ?? null;
  }

  async deleteSession(tokenHash: string) {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }
}
