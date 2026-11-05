import { and, eq, gte, inArray, sum } from "drizzle-orm";
import { dec, toDecimalString } from "../engine/decimal";
import { startOfUtcDay, type NewLock, type VaultStore } from "../engine/vault/store";
import { DEFAULT_GUARDRAILS, type ActionLogEntry, type Guardrails, type Lock, type Violation } from "../engine/vault/types";
import type { Db } from "./client";
import { actionLog, guardrails, locks } from "./schema";

type LockRow = typeof locks.$inferSelect;

// Postgres numeric comes back padded to 18 places; normalise it.
const clean = (value: string) => toDecimalString(dec(value));

function toLock(row: LockRow): Lock {
  return {
    id: row.id,
    userId: row.userId,
    assetId: row.assetId,
    symbol: row.symbol,
    amount: clean(row.amount),
    unlockAt: row.unlockAt,
    schedule: row.schedule?.map((t) => ({ releaseAt: new Date(t.releaseAt), amount: t.amount })),
    status: row.status,
    goalName: row.goalName ?? undefined,
    createdAt: row.createdAt,
    releasedAt: row.releasedAt ?? undefined,
  };
}

export class DrizzleVaultStore implements VaultStore {
  constructor(private readonly db: Db) {}

  async listLocks(userId: string) {
    const rows = await this.db.select().from(locks).where(eq(locks.userId, userId));
    return rows.map(toLock);
  }

  async insertLock(input: NewLock, now: Date) {
    const [row] = await this.db
      .insert(locks)
      .values({
        ...input,
        schedule: input.schedule?.map((t) => ({ releaseAt: t.releaseAt.toISOString(), amount: t.amount })),
        status: "active",
        createdAt: now,
      })
      .returning();
    return toLock(row);
  }

  async closeLock(lockId: string, status: "released" | "exited", now: Date) {
    const [row] = await this.db
      .update(locks)
      .set({ status, releasedAt: now })
      .where(and(eq(locks.id, lockId), eq(locks.status, "active")))
      .returning();
    if (!row) throw new Error(`Lock ${lockId} is not active`);
    return toLock(row);
  }

  async getGuardrails(userId: string): Promise<Guardrails> {
    const [row] = await this.db.select().from(guardrails).where(eq(guardrails.userId, userId));
    if (!row) return DEFAULT_GUARDRAILS;
    return {
      maxDailySpendUsd: row.maxDailySpendUsd ? clean(row.maxDailySpendUsd) : undefined,
      maxSingleTradeUsd: row.maxSingleTradeUsd ? clean(row.maxSingleTradeUsd) : undefined,
      allowedAssetIds: row.allowedAssetIds ?? undefined,
      allowPerps: row.allowPerps,
    };
  }

  async setGuardrails(userId: string, value: Guardrails) {
    const row = {
      maxDailySpendUsd: value.maxDailySpendUsd ?? null,
      maxSingleTradeUsd: value.maxSingleTradeUsd ?? null,
      allowedAssetIds: value.allowedAssetIds ?? null,
      allowPerps: value.allowPerps,
      updatedAt: new Date(),
    };
    await this.db
      .insert(guardrails)
      .values({ userId, ...row })
      .onConflictDoUpdate({ target: guardrails.userId, set: row });
  }

  async appendLog(entry: ActionLogEntry) {
    await this.db.insert(actionLog).values({ ...entry, violations: entry.violations satisfies Violation[] });
  }

  async spentTodayUsd(userId: string, now: Date) {
    const [row] = await this.db
      .select({ total: sum(actionLog.notionalUsd) })
      .from(actionLog)
      .where(
        and(
          eq(actionLog.userId, userId),
          eq(actionLog.outcome, "executed"),
          inArray(actionLog.kind, ["buy", "transfer"]),
          gte(actionLog.at, startOfUtcDay(now)),
        ),
      );
    return row?.total ? clean(row.total) : "0";
  }
}
