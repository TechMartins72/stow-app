"use client";

import Link from "next/link";
import { useState } from "react";
import { dec } from "@/engine/decimal";
import { networkLabel } from "@/app/_lib/address";
import { formatQty, formatUsd } from "@/app/_lib/format";
import type { MarketAsset } from "@/app/_server/market";
import { AssetLogo } from "@/app/_components/asset-logo";
import { LockIcon } from "@/app/_components/icons";
import { ChangePill, Sparkline } from "@/app/_components/price-bits";

type Filter = "all" | "stock" | "crypto";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "stock", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
];

export function MarketList({ assets }: { assets: MarketAsset[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const term = q.trim().toLowerCase();
  const match = (a: MarketAsset) =>
    (filter === "all" || a.assetClass === filter) && (!term || a.name.toLowerCase().includes(term) || a.ticker.toLowerCase().includes(term));
  const owned = assets.filter((a) => dec(a.owned) > 0n && match(a));
  const stocks = assets.filter((a) => a.assetClass === "stock" && dec(a.owned) === 0n && match(a));
  const crypto = assets.filter((a) => a.assetClass === "crypto" && dec(a.owned) === 0n && match(a));
  const movers = [...assets]
    .filter((a) => a.change24h && a.change24h.direction !== "flat")
    .sort((x, y) => Math.abs(y.change24h!.pct) - Math.abs(x.change24h!.pct))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {movers.length > 0 && !term && filter === "all" ? (
        <section aria-labelledby="movers-title">
          <h2 id="movers-title" className="display mb-3 text-xl">
            Biggest moves today
          </h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
            {movers.map((a) => (
              <Link
                key={a.assetId}
                href={`/invest/${a.assetId}`}
                className="min-w-[180px] snap-start rounded-[20px] border border-border bg-surface-raised p-4 hover:border-text-muted/40"
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
                  {a.change24h ? <Sparkline prices={a.sparkline} direction={a.change24h.direction} width={64} height={28} /> : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="search" className="sr-only">
          Search stocks and crypto
        </label>
        <input
          id="search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Apple, NVDA, Bitcoin…"
          className="w-full flex-1 rounded-2xl border border-border bg-surface-raised px-4 py-3.5 focus:outline-2 focus:outline-primary"
        />
        <div role="tablist" aria-label="Show" className="flex gap-1 rounded-2xl bg-border/50 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${filter === f.value ? "bg-surface-raised shadow-sm" : "text-text-muted hover:text-text"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Section title="Your investments" items={owned} showPosition />
      <Section title="Stocks" items={stocks} />
      <Section title="Crypto" items={crypto} />
      {owned.length + stocks.length + crypto.length === 0 ? <p className="text-center text-text-muted">Nothing matches “{q}”.</p> : null}

      <p className="text-center text-xs text-text-muted">
        More stocks are coming soon. Prices are live market data; you&apos;ll see an exact quote before buying.
      </p>
    </div>
  );
}

function Section({ title, items, showPosition = false }: { title: string; items: MarketAsset[]; showPosition?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="display mb-3 text-xl">
        {title} <span className="num text-base text-text-muted">· {items.length}</span>
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface-raised">
        {items.map((a) => (
          <li key={a.assetId}>
            <Link href={`/invest/${a.assetId}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface sm:px-5">
              <AssetLogo icon={a.icon} ticker={a.ticker} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-bold">{a.name}</span>
                  {a.tradability === "sell_only" ? (
                    <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-bold text-warning">Sell only</span>
                  ) : null}
                </span>
                <span className="block text-xs text-text-muted">
                  {a.ticker} · {networkLabel(a.chain)}
                </span>
              </span>
              {a.change24h ? (
                <span className="hidden sm:block">
                  <Sparkline prices={a.sparkline} direction={a.change24h.direction} />
                </span>
              ) : null}
              <span className="min-w-[96px] text-right">
                {showPosition ? (
                  <>
                    <span className="num block font-bold">{formatUsd(a.valueUsd)}</span>
                    <span className="num flex items-center justify-end gap-1 text-xs text-text-muted">
                      {dec(a.locked) > 0n ? <LockIcon className="size-3 text-locked" /> : null}
                      {formatQty(a.owned, 4)} {a.ticker}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="num block font-bold">{a.priceUsd ? formatUsd(a.priceUsd) : "—"}</span>
                    {a.change24h ? <ChangePill pct={a.change24h.pct} direction={a.change24h.direction} /> : null}
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
