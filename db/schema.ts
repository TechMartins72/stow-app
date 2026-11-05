import { boolean, index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 38, scale: 18 });
const at = (name: string) => timestamp(name, { withTimezone: true });

// Row-level security is on for every table with no policies, so Supabase's
// public Data API (anon/authenticated keys) can read nothing. The app connects
// as the table owner, which RLS doesn't restrict.

export const lockStatus = pgEnum("lock_status", ["active", "released", "exited"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // Set once the Gateway user and wallets exist.
  gatewayUserId: text("gateway_user_id").unique(),
  riskProfile: text("risk_profile"),
  createdAt: at("created_at").notNull().defaultNow(),
}).enableRLS();

export const locks = pgTable(
  "locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    assetId: text("asset_id").notNull(),
    symbol: text("symbol").notNull(),
    amount: money("amount").notNull(),
    unlockAt: at("unlock_at").notNull(),
    // Release in parts: [{ releaseAt: ISO string, amount: decimal string }]. Null: all on unlock_at.
    schedule: jsonb("schedule").$type<{ releaseAt: string; amount: string }[]>(),
    status: lockStatus("status").notNull().default("active"),
    goalName: text("goal_name"),
    createdAt: at("created_at").notNull().defaultNow(),
    releasedAt: at("released_at"),
  },
  (t) => [index("locks_user_status_idx").on(t.userId, t.status)],
).enableRLS();

export const guardrails = pgTable("guardrails", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  maxDailySpendUsd: money("max_daily_spend_usd"),
  maxSingleTradeUsd: money("max_single_trade_usd"),
  allowedAssetIds: text("allowed_asset_ids").array(),
  allowPerps: boolean("allow_perps").notNull().default(false),
  updatedAt: at("updated_at").notNull().defaultNow(),
}).enableRLS();

export const actionLog = pgTable(
  "action_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    actor: text("actor", { enum: ["user", "advisor"] }).notNull(),
    kind: text("kind", { enum: ["buy", "sell", "transfer"] }).notNull(),
    assetId: text("asset_id").notNull(),
    symbol: text("symbol").notNull(),
    notionalUsd: money("notional_usd").notNull(),
    outcome: text("outcome", { enum: ["blocked", "executed", "failed"] }).notNull(),
    violations: jsonb("violations").notNull().default([]),
    gatewayRef: text("gateway_ref"),
    at: at("at").notNull().defaultNow(),
  },
  (t) => [index("action_log_user_at_idx").on(t.userId, t.at)],
).enableRLS();
