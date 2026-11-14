// Home's account sections: summary, vault, assets, movers, coming up, recent activity.
// Server components; amounts arrive as decimal strings and are only formatted here.

import Link from "next/link";
import { dec, ZERO } from "@/engine/decimal";
import { ActivityRow } from "@/app/activity/activity-list";
import type { ActivityItem } from "@/app/_lib/activity";
import type { AllocationSlice, Bucket, UpcomingRelease } from "@/app/_lib/home-summary";
import { countdown, formatDate, formatQty, formatUsd } from "@/app/_lib/format";
import type { HomeHolding, HomeLock } from "@/app/_server/home";
import type { MarketAsset } from "@/app/_server/market";
import { AssetLogo } from "./asset-logo";
import { NoLocksCard, SectionHeading } from "./home-sections";
import { ArrowRightIcon, CalendarIcon, LockIcon, PadlockMotif } from "./icons";
import { LockCard } from "./lock-card";
import { ChangePill, Sparkline } from "./price-bits";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A peek into the Vault: how many goals and budgets, and the soonest few. */
export function VaultSnippet({
  locks,
  counts,
  lockedUsd,
  now,
  highlight,
}: {
  locks: HomeLock[];
  counts: { goals: number; budgets: number };
  lockedUsd: string;
  now: Date;
  highlight?: string;
}) {
  return (
    <section aria-labelledby="vault-title">
      <SectionHeading id="vault-title" title="Your vault" action={{ label: "Open vault", href: "/vault" }} />
      {locks.length === 0 ? (
        <NoLocksCard />
      ) : (
        <>
          <p className="num mb-3 text-sm text-text-muted">
            {formatUsd(lockedUsd)} put away in{" "}
            {[
              counts.goals ? plural(counts.goals, "savings goal", "savings goals") : null,
              counts.budgets ? plural(counts.budgets, "budget", "budgets") : null,
            ]
              .filter(Boolean)
              .join(" and ")}
            .{counts.budgets === 0 ? " Try a budget to pay yourself back a little each month." : ""}
          </p>
          <div className="relative -mx-4 flex snap-x gap-4 no-scrollbar overflow-x-auto scroll-px-4 px-4 sm:scroll-px-0 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
            {locks.slice(0, 2).map((lock) => (
              <LockCard key={lock.id} lock={lock} now={now} highlight={lock.id === highlight} />
            ))}
          </div>
          {locks.length > 2 ? (
            <Link href="/vault" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              {plural(locks.length - 2, "more", "more")} in your vault <ArrowRightIcon className="size-4" />
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}

/** The Invest list's biggest 24-hour moves, each linking to its page. */
export function MarketMovers({ movers }: { movers: MarketAsset[] }) {
  if (movers.length === 0) return null;
  return (
    <section aria-labelledby="movers-title">
      <SectionHeading id="movers-title" title="Biggest moves today" action={{ label: "All markets", href: "/invest" }} />
      <div className="relative -mx-4 flex snap-x gap-3 no-scrollbar overflow-x-auto scroll-px-4 px-4 sm:scroll-px-0 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 xl:grid-cols-4">
        {movers.map((a) => (
          <Link
            key={a.assetId}
            href={`/invest/${a.assetId}`}
            className={`${card} min-w-[170px] snap-start p-4 hover:border-text-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
          >
            <div className="flex items-center gap-2.5">
              <AssetLogo icon={a.icon} ticker={a.ticker} size={32} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{a.name}</span>
                <span className="block text-xs text-text-muted">{a.ticker}</span>
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <span>
                <span className="num block font-bold">{a.priceUsd ? formatUsd(a.priceUsd) : "—"}</span>
                {a.change24h ? <ChangePill pct={a.change24h.pct} direction={a.change24h.direction} /> : null}
              </span>
              {a.change24h ? <Sparkline prices={a.sparkline} direction={a.change24h.direction} width={56} height={26} /> : null}
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-muted">Market prices, for information. Locked money is never traded.</p>
    </section>
  );
}

/** Points to the Learn page: how saving and budgeting work here. */
export function LearnCard() {
  return (
    <Link
      href="/learn"
      className="group relative block overflow-hidden rounded-[20px] bg-frame p-5 text-frame-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <PadlockMotif className="pointer-events-none absolute -right-6 -bottom-8 size-32 text-white/10" />
      <p className="relative text-xs font-bold tracking-wide text-hero uppercase">New here?</p>
      <h2 className="relative mt-1 text-base font-bold">How saving and budgeting work</h2>
      <p className="relative mt-1 text-sm text-frame-muted">Goals, budgets that pay you back, and why the app says no. A 3-minute read.</p>
      <span className="relative mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white group-hover:underline">
        Learn about the app <ArrowRightIcon className="size-4" />
      </span>
    </Link>
  );
}

const card = "rounded-[20px] border border-border bg-surface-raised";
const SWATCH: Record<Bucket, string> = { cash: "bg-hero", crypto: "bg-primary", stocks: "bg-stocks" };
const pct = (bps: number) => `${(bps / 100).toFixed(bps > 0 && bps < 100 ? 1 : 0)}%`;

/** Where the money sits (cash, crypto, stocks) and a few account facts. */
export function AccountSummary({
  slices,
  assetCount,
  lockCount,
  next,
}: {
  slices: AllocationSlice[];
  assetCount: number;
  lockCount: number;
  next: (UpcomingRelease & { ticker: string }) | undefined;
}) {
  const shown = slices.filter((s) => s.bps > 0);
  const described = slices.map((s) => `${s.label} ${pct(s.bps)}`).join(", ");
  return (
    <section aria-labelledby="summary-title" className={`${card} p-5 sm:p-6`}>
      <h2 id="summary-title" className="display text-xl">
        Account summary
      </h2>
      <p className="text-sm text-text-muted">Where your money is right now</p>

      <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-border" role="img" aria-label={described}>
        {shown.map((s) => (
          <div key={s.bucket} className={`h-full ${SWATCH[s.bucket]}`} style={{ width: `${s.bps / 100}%` }} />
        ))}
      </div>
      {/* Narrow phones: one row per bucket (label left, amount right). Wider: three columns. */}
      <dl className="mt-4 grid gap-2 min-[420px]:grid-cols-3 min-[420px]:gap-3">
        {slices.map((s) => (
          <div key={s.bucket} className="flex min-w-0 items-baseline justify-between gap-3 min-[420px]:block">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
              <span className={`size-2.5 shrink-0 rounded-full ${SWATCH[s.bucket]}`} aria-hidden />
              {s.label} <span className="num">{pct(s.bps)}</span>
            </dt>
            <dd className="num mt-0.5 text-base font-bold min-[420px]:truncate sm:text-lg">{formatUsd(s.valueUsd)}</dd>
          </div>
        ))}
      </dl>

      <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
        <Fact label="Assets held" value={String(assetCount)} />
        <Fact label="Goals and budgets" value={String(lockCount)} href="/vault" />
        <Fact
          label="Next money freed"
          value={next ? `${formatQty(next.amount)} ${next.ticker}` : "Nothing scheduled"}
          sub={next ? `${formatDate(next.releaseAt)}` : undefined}
          href={next ? `/vault/${next.lockId}` : undefined}
        />
      </dl>
    </section>
  );
}

function Fact({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <dt className="text-xs font-semibold text-text-muted">{label}</dt>
      <dd className="num mt-0.5 font-bold">
        {value}
        {sub ? <span className="ml-1.5 font-semibold text-text-muted">{sub}</span> : null}
      </dd>
    </>
  );
  return href ? (
    <Link href={href} className="-m-1.5 rounded-xl p-1.5 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

/** Every asset in the wallet, largest value first, with how much of it is locked. */
export function HoldingsList({ holdings }: { holdings: HomeHolding[] }) {
  return (
    <section aria-labelledby="assets-title">
      <SectionHeading id="assets-title" title="Your assets" action={{ label: "See portfolio", href: "/portfolio" }} />
      <ul className={`${card} divide-y divide-border overflow-hidden`}>
        {holdings.map((h) => (
          <li key={h.assetId}>
            <HoldingRow h={h} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HoldingRow({ h }: { h: HomeHolding }) {
  const locked = dec(h.lockedQty) > ZERO;
  const allLocked = locked && dec(h.lockedQty) >= dec(h.qty);
  const body = (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <AssetLogo icon={h.icon} ticker={h.ticker} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{h.name}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
          <span>
            {h.ticker} · {h.network}
          </span>
          {locked ? (
            <span className="num inline-flex items-center gap-1 rounded-full bg-locked/10 px-2 py-0.5 font-bold text-locked dark:bg-locked/30 dark:text-frame-text">
              <LockIcon className="size-3" />
              {allLocked ? "All locked" : `${formatQty(h.lockedQty)} locked`}
            </span>
          ) : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="num font-bold">{formatUsd(h.valueUsd)}</p>
        <p className="num text-xs text-text-muted">
          {formatQty(h.qty)} {h.ticker}
        </p>
        {h.change24h ? <ChangePill pct={h.change24h.pct} direction={h.change24h.direction} /> : null}
      </div>
    </div>
  );
  return h.href ? (
    <Link href={h.href} className="block hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
      {body}
    </Link>
  ) : (
    body
  );
}

/** The next few parts that free themselves, across all locks. */
export function ComingUp({ releases, now }: { releases: (UpcomingRelease & { ticker: string })[]; now: Date }) {
  return (
    <section aria-labelledby="coming-title" className={`${card} p-5`}>
      <h2 id="coming-title" className="flex items-center gap-2 text-base font-bold">
        <CalendarIcon className="size-5 text-locked dark:text-frame-text" /> Coming up
      </h2>
      {releases.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">Nothing scheduled. Budget pay-outs and goal dates show up here.</p>
      ) : (
        <ol className="mt-3 space-y-1">
          {releases.map((r) => (
            <li key={`${r.lockId}-${r.part}`}>
              <Link
                href={`/vault/${r.lockId}`}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="num grid w-11 shrink-0 rounded-xl bg-locked/10 py-1 text-center leading-tight text-locked dark:bg-locked/30 dark:text-frame-text">
                  <span className="text-[calc(10px*var(--fs))] font-bold uppercase">
                    {r.releaseAt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
                  </span>
                  <span className="text-base font-extrabold">{r.releaseAt.getUTCDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="num block font-bold">
                    {formatQty(r.amount)} {r.ticker}
                  </span>
                  <span className="block truncate text-xs text-text-muted">
                    {r.goalName}
                    {r.parts > 1 ? ` · part ${r.part} of ${r.parts}` : ""}
                  </span>
                </span>
                <span className="num shrink-0 text-xs font-semibold text-text-muted">in {countdown(r.releaseAt, now).label}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The last few things that happened, including anything the app refused. */
export function RecentActivity({ items }: { items: ActivityItem[] | null }) {
  return (
    <section aria-labelledby="recent-title">
      <SectionHeading id="recent-title" title="Recent activity" action={{ label: "See all", href: "/activity" }} />
      {items === null ? (
        <p className={`${card} p-5 text-sm text-text-muted`}>We couldn&apos;t load your recent activity just now. Your balances above are up to date.</p>
      ) : items.length === 0 ? (
        <p className={`${card} p-5 text-sm text-text-muted`}>Nothing yet. Trades, sends, locks and anything the app refused will show here.</p>
      ) : (
        <ul className={`${card} divide-y divide-border overflow-hidden`}>
          {items.map((item) => (
            <li key={item.id}>
              <ActivityRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
