// One timeline from three sources: True Markets' history (orders and
// transfers), the SigningGuard's log (who acted, and what it refused), and the
// locks (created, and each part as it frees itself). Pure, so it's testable.

import { dec } from "@/engine/decimal";
import { tranchesOf } from "@/engine/vault/schedule";
import type { TransactionRow } from "@/engine/gateway/types";
import type { ActionLogEntry, Lock } from "@/engine/vault/types";
import { networkLabel, shortAddress } from "./address";
import { formatQty, formatUsd } from "./format";

export type ActivityKind = "buy" | "sell" | "deposit" | "send" | "lock" | "release" | "blocked";
export type ActivityFilter = "all" | "trades" | "transfers" | "locks" | "blocked";

export interface ActivityItem {
  id: string;
  at: Date;
  kind: ActivityKind;
  title: string;
  detail: string;
  /** Who asked for it, when we know. */
  actor?: "you" | "advisor";
  status: "done" | "pending" | "failed" | "blocked";
  /** A page in the app, or (starting with https://) a public block explorer. */
  href?: string;
}

export const FILTERS: { value: ActivityFilter; label: string; kinds: ActivityKind[] }[] = [
  { value: "all", label: "All", kinds: ["buy", "sell", "deposit", "send", "lock", "release", "blocked"] },
  { value: "trades", label: "Trades", kinds: ["buy", "sell"] },
  { value: "transfers", label: "Deposits & sends", kinds: ["deposit", "send"] },
  { value: "locks", label: "Locks", kinds: ["lock", "release"] },
  { value: "blocked", label: "Blocked", kinds: ["blocked"] },
];

const statusOf = (s: string): ActivityItem["status"] =>
  s === "completed" || s === "complete" ? "done" : s === "failed" || s === "canceled" ? "failed" : "pending";

export function buildActivity(input: {
  transactions: TransactionRow[];
  log: ActionLogEntry[];
  locks: Lock[];
  now: Date;
  /** Token symbol -> what people call it, e.g. AAPLC -> AAPL. */
  tickers?: Record<string, string>;
}): ActivityItem[] {
  const { transactions, log, locks, now } = input;
  const ticker = (symbol: string) => input.tickers?.[symbol] ?? symbol;
  const actorByRef = new Map(log.filter((e) => e.gatewayRef).map((e) => [e.gatewayRef!, e.actor === "advisor" ? "advisor" : "you"] as const));
  const items: ActivityItem[] = [];

  for (const t of transactions) {
    if (t.type === "received_transfer" && t.received_transfer) {
      // Money in from outside. True Markets reports it once it's in a block, so it's always done.
      const r = t.received_transfer;
      items.push({
        id: t.id,
        at: new Date(r.observed_at ?? String(t.created_at ?? now.toISOString())),
        kind: "deposit",
        title: `Received ${formatQty(r.amount, 6)} ${ticker(r.token_symbol)}`,
        detail: `From ${shortAddress(r.from_address)} · ${networkLabel(r.chain)}`,
        status: "done",
        href: typeof t.explorer_url === "string" && t.explorer_url.startsWith("https://") ? t.explorer_url : undefined,
      });
      continue;
    }
    const at = new Date(String(t.created_at ?? t.order?.created_at ?? t.transfer?.created_at ?? now.toISOString()));
    if (t.type === "order" && t.order) {
      const o = t.order;
      const sym = ticker(o.asset_symbol ?? o.base_asset ?? "");
      const got = o.executed_qty && dec(o.executed_qty) > 0n ? o.executed_qty : null;
      if (o.side === "buy") {
        items.push({
          id: t.id,
          at,
          kind: "buy",
          title: got ? `Bought ${formatQty(got, 6)} ${sym}` : `Buy ${sym}`,
          detail: `${formatUsd(o.qty)} of USDC`,
          actor: actorByRef.get(o.order_id),
          status: statusOf(t.status),
        });
      } else {
        items.push({
          id: t.id,
          at,
          kind: "sell",
          title: `Sold ${formatQty(o.qty, 6)} ${sym}`,
          detail: o.executed_vwap ? `At ${formatUsd(o.executed_vwap)} each` : "For USDC",
          actor: actorByRef.get(o.order_id),
          status: statusOf(t.status),
        });
      }
    } else if (t.type === "transfer" && t.transfer) {
      const tr = t.transfer;
      items.push({
        id: t.id,
        at,
        kind: "send",
        title: `Sent ${formatQty(tr.qty, 6)} ${ticker(tr.asset_symbol)}`,
        detail: `To ${shortAddress(tr.to)}`,
        actor: actorByRef.get(tr.id),
        status: statusOf(t.status),
      });
    }
  }

  for (const e of log) {
    if (e.outcome !== "blocked") continue;
    const verb = e.kind === "transfer" ? "Send" : e.kind === "buy" ? "Buy" : "Sell";
    items.push({
      id: `blocked-${e.at.getTime()}-${e.assetId}-${e.kind}`,
      at: e.at,
      kind: "blocked",
      title: `${verb} ${ticker(e.symbol)} refused`,
      detail: e.violations[0]?.message ?? "A rule said no.",
      actor: e.actor === "advisor" ? "advisor" : "you",
      status: "blocked",
    });
  }

  for (const l of locks) {
    const name = l.goalName ?? `${l.symbol} lock`;
    items.push({
      id: `lock-${l.id}`,
      at: l.createdAt,
      kind: "lock",
      title: `Locked ${formatQty(l.amount, 6)} ${ticker(l.symbol)}`,
      detail: name,
      actor: "you",
      status: "done",
      href: `/vault/${l.id}`,
    });
    const parts = tranchesOf(l);
    parts.forEach((p, i) => {
      if (p.releaseAt > now || l.status !== "active") return;
      items.push({
        id: `release-${l.id}-${i}`,
        at: p.releaseAt,
        kind: "release",
        title: `${formatQty(p.amount, 6)} ${ticker(l.symbol)} unlocked`,
        detail: parts.length > 1 ? `${name} · part ${i + 1} of ${parts.length}` : name,
        status: "done",
        href: `/vault/${l.id}`,
      });
    });
  }

  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function filterActivity(items: ActivityItem[], filter: ActivityFilter): ActivityItem[] {
  const kinds = FILTERS.find((f) => f.value === filter)?.kinds ?? [];
  return items.filter((i) => kinds.includes(i.kind));
}

/** "Today", "Yesterday", or a date, in UTC so server and browser agree. */
export function dayLabel(at: Date, now: Date): string {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.round((day(now) - day(at)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return at.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
