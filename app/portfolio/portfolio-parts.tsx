// The Portfolio page's pieces. Amounts arrive as decimal strings and are only
// formatted here; quantities show each coin's own decimals (SOL 9, USDC 6, stocks 8).

import Link from "next/link";
import { dec, ZERO } from "@/engine/decimal";
import { AssetLogo } from "@/app/_components/asset-logo";
import { CalendarIcon, LockIcon, PadlockMotif } from "@/app/_components/icons";
import { ChangePill, Sparkline } from "@/app/_components/price-bits";
import { formatDate, formatQty, formatUsd } from "@/app/_lib/format";
import type { PortfolioData, PortfolioHolding } from "@/app/_server/portfolio";

const card = "rounded-[20px] border border-border bg-surface-raised";
type Tone = "cash" | "crypto" | "stocks";
const SWATCH: Record<Tone, string> = { cash: "bg-hero", crypto: "bg-primary", stocks: "bg-stocks" };
const pct = (bps: number) => `${(bps / 100).toFixed(bps > 0 && bps < 100 ? 1 : 0)}%`;
const direction = (v: string) => (dec(v) > ZERO ? "up" : dec(v) < ZERO ? "down" : "flat") as "up" | "down" | "flat";
const signedUsd = (v: string) => `${dec(v) > ZERO ? "+" : ""}${formatUsd(v)}`;

/** Total value, today's change, and how much is free versus put away. */
export function PortfolioHero({ data }: { data: PortfolioData }) {
  const total = dec(data.totalUsd);
  const lockedPct = total > ZERO ? Number((dec(data.lockedUsd) * 10_000n) / total) / 100 : 0;
  const dir = direction(data.change24hUsd);
  return (
    <section aria-labelledby="pf-total" className="relative overflow-hidden rounded-[24px] bg-hero p-5 shadow-[0_18px_40px_-20px_rgba(0,137,255,0.65)] sm:p-8">
      <PadlockMotif className="pointer-events-none absolute -right-10 -bottom-14 size-64 text-white/15" />
      <h2 id="pf-total" className="relative text-sm font-semibold text-frame">
        Total value
      </h2>
      <p className="num display relative mt-1 text-[calc(40px*var(--fs))] leading-none text-white sm:text-[52px]">{formatUsd(data.totalUsd)}</p>
      <p className="num relative mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-frame">
        <span aria-hidden>{dir === "up" ? "▲" : dir === "down" ? "▼" : "•"}</span>
        {signedUsd(data.change24hUsd)} ({dir === "down" ? "−" : dir === "up" ? "+" : ""}
        {Math.abs(data.change24hBps / 100).toFixed(2)}%) today
      </p>

      <div className="relative mt-6">
        <div className="flex h-3 overflow-hidden rounded-full bg-white" role="img" aria-label={`${Math.round(lockedPct)}% saved or budgeted`}>
          <div className="h-full bg-locked" style={{ width: `${lockedPct}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-frame">
              <span className="size-2.5 rounded-full bg-locked" aria-hidden /> Saved &amp; budgeted
            </dt>
            <dd className="num mt-0.5 text-lg font-bold text-frame">{formatUsd(data.lockedUsd)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-frame">
              <span className="size-2.5 rounded-full bg-white" aria-hidden /> Free to spend
            </dt>
            <dd className="num mt-0.5 text-lg font-bold text-frame">{formatUsd(data.freeUsd)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/** A split bar with a legend: by type, or by network. */
export function Breakdown({ title, slices }: { title: string; slices: { label: string; valueUsd: string; bps: number; tone: Tone }[] }) {
  const shown = slices.filter((s) => s.bps > 0);
  return (
    <section aria-label={title} className={`${card} p-5`}>
      <h2 className="text-base font-bold">{title}</h2>
      <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-border" role="img" aria-label={slices.map((s) => `${s.label} ${pct(s.bps)}`).join(", ")}>
        {shown.map((s) => (
          <div key={s.label} className={`h-full ${SWATCH[s.tone]}`} style={{ width: `${s.bps / 100}%` }} />
        ))}
      </div>
      <dl className="mt-4 space-y-2">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="flex items-center gap-2 font-semibold">
              <span className={`size-2.5 shrink-0 rounded-full ${SWATCH[s.tone]}`} aria-hidden />
              {s.label}
            </dt>
            <dd className="num text-right">
              <span className="font-bold">{formatUsd(s.valueUsd)}</span>
              <span className="ml-2 text-text-muted">{pct(s.bps)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** One holding: value, amount with full decimals, free / locked / in orders, the plans holding it, and actions. */
export function HoldingCard({ h }: { h: PortfolioHolding }) {
  const total = dec(h.total);
  const share = (qty: string) => (total > ZERO ? Number((dec(qty) * 10_000n) / total) / 100 : 0);
  const free = dec(h.freeQty) > ZERO;
  const qty = (v: string) => `${formatQty(v, h.decimals)} ${h.ticker}`;

  return (
    <article aria-labelledby={`h-${h.assetId}`} className={`${card} p-5 sm:p-6`}>
      <header className="flex items-start gap-3">
        <AssetLogo icon={h.icon} ticker={h.ticker} size={44} />
        <div className="min-w-0 flex-1">
          <h3 id={`h-${h.assetId}`} className="truncate text-base font-bold">
            {h.name}
          </h3>
          <p className="text-xs text-text-muted">
            {h.ticker} · {h.network}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-lg font-bold">{formatUsd(h.valueUsd)}</p>
          {h.change24hPct ? <ChangePill pct={h.change24hPct.pct} direction={h.change24hPct.direction} /> : <span className="text-xs text-text-muted">Cash</span>}
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <Fact label="Amount" value={qty(h.total)} />
        <Fact label="Price" value={h.bucket === "cash" ? "$1.00" : formatUsd(h.priceUsd)} />
        <Fact label="Share of portfolio" value={pct(h.shareBps)} />
        <Fact label="Today" value={h.change24hUsd === null ? "—" : signedUsd(h.change24hUsd)} tone={h.change24hUsd === null ? undefined : direction(h.change24hUsd)} />
      </dl>
      {h.sparkline.length > 1 && h.change24hPct ? (
        <div className="mt-3 hidden sm:block">
          <Sparkline prices={h.sparkline} direction={h.change24hPct.direction} width={220} height={36} />
        </div>
      ) : null}

      {/* Free / locked / in orders */}
      <div className="mt-5">
        <div
          className="flex h-2.5 overflow-hidden rounded-full bg-border"
          role="img"
          aria-label={`${share(h.freeQty).toFixed(0)}% free, ${share(h.lockedQty).toFixed(0)}% locked${dec(h.heldQty) > ZERO ? `, ${share(h.heldQty).toFixed(0)}% in open orders` : ""}`}
        >
          <div className="h-full bg-hero" style={{ width: `${share(h.freeQty)}%` }} />
          <div className="h-full bg-locked" style={{ width: `${share(h.lockedQty)}%` }} />
          <div className="h-full bg-warning" style={{ width: `${share(h.heldQty)}%` }} />
        </div>
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          <Split swatch="bg-hero" label="Free" value={qty(h.freeQty)} />
          <Split swatch="bg-locked" label="Saved & budgeted" value={qty(h.lockedQty)} />
          {dec(h.heldQty) > ZERO ? <Split swatch="bg-warning" label="In open orders" value={qty(h.heldQty)} /> : null}
        </dl>
      </div>

      {h.plans.length > 0 ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-bold tracking-wide text-text-muted uppercase">Held by</p>
          <ul className="mt-2 space-y-1">
            {h.plans.map((p) => (
              <li key={p.lockId}>
                <Link href={`/vault/${p.lockId}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-locked/10 text-locked dark:bg-locked/30 dark:text-frame-text" aria-hidden>
                    {p.kind === "budget" ? <CalendarIcon className="size-4" /> : <LockIcon className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{p.goalName}</span>
                    <span className="num block text-xs text-text-muted">
                      {p.kind === "budget" ? "Budget" : "Savings goal"} · {qty(p.lockedQty)}
                    </span>
                  </span>
                  {p.nextAt ? (
                    <span className="num shrink-0 text-right text-xs text-text-muted">
                      {p.kind === "budget" && p.nextQty ? `${formatQty(p.nextQty, h.decimals)} frees` : "Frees"}
                      <br />
                      {formatDate(p.nextAt)}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {h.investHref && h.canBuy ? <Action href={h.investHref}>Buy</Action> : null}
        {h.investHref && h.canSell && free ? <Action href={h.investHref}>Sell</Action> : null}
        {h.canSend && free ? <Action href={`/withdraw?asset=${encodeURIComponent(h.assetId)}`}>Withdraw</Action> : null}
        {free ? <Action href="/vault/new">Save or budget</Action> : null}
      </div>
    </article>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  const color = tone === "up" ? "text-positive" : tone === "down" ? "text-negative" : "";
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-text-muted">{label}</dt>
      <dd className={`num mt-0.5 font-bold break-words ${color}`}>{value}</dd>
    </div>
  );
}

function Split({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="flex items-center gap-1.5 text-text-muted">
        <span className={`size-2 shrink-0 rounded-full ${swatch}`} aria-hidden />
        {label}
      </dt>
      <dd className="num font-semibold">{value}</dd>
    </div>
  );
}

function Action({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-text-muted/40 focus-visible:outline-2 focus-visible:outline-primary">
      {children}
    </Link>
  );
}
