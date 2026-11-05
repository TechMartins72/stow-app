export type LockStatus = "active" | "released" | "exited";
export type Actor = "user" | "advisor";

/** An amount of one asset the app refuses to co-sign out of until it is released. */
export interface Lock {
  id: string;
  userId: string;
  assetId: string;
  symbol: string;
  amount: string;
  unlockAt: Date;
  status: LockStatus;
  goalName?: string;
  createdAt: Date;
  releasedAt?: Date;
}

export interface Guardrails {
  /** Spend (buys and withdrawals) allowed per UTC day, in USD. */
  maxDailySpendUsd?: string;
  maxSingleTradeUsd?: string;
  /** When set, only these asset ids may be traded. */
  allowedAssetIds?: string[];
  /** Leverage stays off in this build; the flag exists so the rule is explicit. */
  allowPerps: boolean;
}

export const DEFAULT_GUARDRAILS: Guardrails = { allowPerps: false };

/** An asset quantity leaving the user's wallet if the action runs. */
export interface Debit {
  assetId: string;
  symbol: string;
  qty: string;
}

export interface ProposedAction {
  kind: "buy" | "sell" | "transfer";
  actor: Actor;
  assetId: string;
  symbol: string;
  productType: "spot" | "perp";
  debits: Debit[];
  notionalUsd: string;
}

export type ViolationRule =
  | "locked"
  | "insufficient_balance"
  | "asset_not_allowed"
  | "perps_disabled"
  | "single_trade_limit"
  | "daily_limit";

export interface Violation {
  rule: ViolationRule;
  message: string;
}

export interface Decision {
  allowed: boolean;
  violations: Violation[];
}

export interface ActionLogEntry {
  userId: string;
  actor: Actor;
  kind: ProposedAction["kind"];
  assetId: string;
  symbol: string;
  notionalUsd: string;
  outcome: "blocked" | "executed" | "failed";
  violations: Violation[];
  gatewayRef?: string;
  at: Date;
}
