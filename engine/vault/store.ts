import { randomUUID } from "node:crypto";
import { dec, sum, toDecimalString } from "../decimal";
import { DEFAULT_GUARDRAILS, type ActionLogEntry, type Guardrails, type Lock, type Tranche } from "./types";

export interface NewLock {
  userId: string;
  assetId: string;
  symbol: string;
  amount: string;
  unlockAt: Date;
  schedule?: Tranche[];
  goalName?: string;
}

/** Persistence for locks, guardrails and the action log. Postgres in the app, memory in scripts and tests. */
export interface VaultStore {
  listLocks(userId: string): Promise<Lock[]>;
  insertLock(lock: NewLock, now: Date): Promise<Lock>;
  /** Moves a lock out of `active`. Callers enforce maturity; see vault/locks.ts. */
  closeLock(lockId: string, status: "released" | "exited", now: Date): Promise<Lock>;
  getGuardrails(userId: string): Promise<Guardrails>;
  setGuardrails(userId: string, guardrails: Guardrails): Promise<void>;
  appendLog(entry: ActionLogEntry): Promise<void>;
  /** USD spent today: executed buys and withdrawals since UTC midnight. */
  spentTodayUsd(userId: string, now: Date): Promise<string>;
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export class MemoryVaultStore implements VaultStore {
  private locks: Lock[] = [];
  private guardrails = new Map<string, Guardrails>();
  readonly log: ActionLogEntry[] = [];

  async listLocks(userId: string) {
    return this.locks.filter((l) => l.userId === userId).map((l) => ({ ...l }));
  }

  async insertLock(input: NewLock, now: Date) {
    const lock: Lock = { ...input, id: randomUUID(), status: "active", createdAt: now };
    this.locks.push(lock);
    return { ...lock };
  }

  async closeLock(lockId: string, status: "released" | "exited", now: Date) {
    const lock = this.locks.find((l) => l.id === lockId);
    if (!lock) throw new Error(`Lock ${lockId} not found`);
    lock.status = status;
    lock.releasedAt = now;
    return { ...lock };
  }

  async getGuardrails(userId: string) {
    return this.guardrails.get(userId) ?? DEFAULT_GUARDRAILS;
  }

  async setGuardrails(userId: string, guardrails: Guardrails) {
    this.guardrails.set(userId, guardrails);
  }

  async appendLog(entry: ActionLogEntry) {
    this.log.push(entry);
  }

  async spentTodayUsd(userId: string, now: Date) {
    const since = startOfUtcDay(now);
    const spent = this.log.filter(
      (e) => e.userId === userId && e.outcome === "executed" && e.kind !== "sell" && e.at >= since,
    );
    return toDecimalString(sum(spent.map((e) => dec(e.notionalUsd))));
  }
}
