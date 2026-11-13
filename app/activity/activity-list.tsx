"use client";

import Link from "next/link";
import { useState } from "react";
import { dayLabel, filterActivity, FILTERS, type ActivityFilter, type ActivityItem, type ActivityKind } from "@/app/_lib/activity";
import { ArrowRightIcon, LockIcon, PlusIcon, SparkIcon } from "@/app/_components/icons";

const ICON: Record<ActivityKind, { bg: string; node: React.ReactNode }> = {
  buy: { bg: "bg-hero text-white", node: <PlusIcon className="size-4" /> },
  sell: { bg: "bg-frame text-white", node: <ArrowRightIcon className="size-4 rotate-180" /> },
  send: { bg: "bg-frame text-white", node: <ArrowRightIcon className="size-4 -rotate-45" /> },
  lock: { bg: "bg-locked text-white", node: <LockIcon className="size-4" /> },
  release: { bg: "bg-positive text-white", node: <span className="text-sm font-bold">✓</span> },
  blocked: { bg: "bg-critical-bg text-critical", node: <LockIcon className="size-4" /> },
};

export function ActivityList({ items, nowIso }: { items: ActivityItem[]; nowIso: string }) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const now = new Date(nowIso);
  const shown = filterActivity(items, filter);

  // Group consecutive items by day label.
  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const item of shown) {
    const label = dayLabel(item.at, now);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div>
      <div role="tablist" aria-label="Filter activity" className="relative -mx-4 mb-6 flex gap-2 no-scrollbar overflow-x-auto scroll-px-4 px-4 sm:scroll-px-0 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => {
          const count = filterActivity(items, f.value).length;
          return (
            <button
              key={f.value}
              role="tab"
              type="button"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                filter === f.value ? "border-primary bg-primary text-white" : "border-border bg-surface-raised hover:border-text-muted/40"
              }`}
            >
              {f.label} <span className={`num ${filter === f.value ? "text-white/80" : "text-text-muted"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-border bg-surface-raised p-8 text-center">
          <p className="font-bold">Nothing here yet</p>
          <p className="mt-1 text-sm text-text-muted">Trades, sends, locks and anything the app refused will show up here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-text-muted uppercase">{g.label}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface-raised">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <ActivityRow item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** One activity line; also used for the short list on Home. */
export function ActivityRow({ item }: { item: ActivityItem }) {
  const icon = ICON[item.kind];
  const time = item.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  const body = (
    <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${icon.bg}`} aria-hidden>
        {icon.node}
      </span>
      <div className="min-w-0 flex-1">
        <p className="num font-bold">{item.title}</p>
        <p className="truncate text-sm text-text-muted">{item.detail}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {item.actor === "advisor" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-hero/15 px-2 py-0.5 font-semibold text-hero">
              <SparkIcon className="size-3" /> Advisor
            </span>
          ) : null}
          {item.status === "pending" ? <span className="rounded-full bg-warning-bg px-2 py-0.5 font-semibold text-warning">Confirming</span> : null}
          {item.status === "failed" ? <span className="rounded-full bg-critical-bg px-2 py-0.5 font-semibold text-critical">Failed</span> : null}
          {item.status === "blocked" ? <span className="rounded-full bg-critical-bg px-2 py-0.5 font-semibold text-critical">Not signed</span> : null}
        </div>
      </div>
      <time dateTime={item.at.toISOString()} className="num shrink-0 text-xs text-text-muted">
        {time} UTC
      </time>
    </div>
  );
  return item.href ? (
    <Link href={item.href} className="block hover:bg-surface">
      {body}
    </Link>
  ) : (
    body
  );
}
