"use client";

import Link from "next/link";
import { useState } from "react";
import { dec } from "@/engine/decimal";
import { networkLabel } from "@/app/_lib/address";
import { formatQty, formatUsd } from "@/app/_lib/format";
import type { MarketAsset } from "@/app/_server/market";
import { LockIcon } from "@/app/_components/icons";

export function MarketList({ assets }: { assets: MarketAsset[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const match = (a: MarketAsset) => !term || a.name.toLowerCase().includes(term) || a.ticker.toLowerCase().includes(term);
  const owned = assets.filter((a) => dec(a.owned) > 0n && match(a));
  const stocks = assets.filter((a) => a.assetClass === "stock" && dec(a.owned) === 0n && match(a));
  const crypto = assets.filter((a) => a.assetClass === "crypto" && dec(a.owned) === 0n && match(a));

  return (
    <div className="space-y-8">
      <div>
        <label htmlFor="search" className="sr-only">
          Search stocks and crypto
        </label>
        <input
          id="search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Apple, NVDA, Solana…"
          className="w-full rounded-2xl border border-border bg-surface-raised px-4 py-3.5 focus:outline-2 focus:outline-primary"
        />
      </div>
      <Section title="Your investments" items={owned} showPosition />
      <Section title="Stocks" items={stocks} />
      <Section title="Crypto" items={crypto} />
      {owned.length + stocks.length + crypto.length === 0 ? <p className="text-center text-text-muted">Nothing matches “{q}”.</p> : null}
    </div>
  );
}

function Section({ title, items, showPosition = false }: { title: string; items: MarketAsset[]; showPosition?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="display mb-3 text-xl">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface-raised">
        {items.map((a) => (
          <li key={a.assetId}>
            <Link href={`/invest/${a.assetId}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface sm:px-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-frame text-[11px] font-extrabold text-white" aria-hidden>
                {a.ticker.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{a.name}</span>
                <span className="block text-xs text-text-muted">
                  {a.ticker} · {networkLabel(a.chain)}
                </span>
              </span>
              <span className="text-right">
                {showPosition ? (
                  <>
                    <span className="num block font-bold">{formatUsd(a.valueUsd)}</span>
                    <span className="num flex items-center justify-end gap-1 text-xs text-text-muted">
                      {dec(a.locked) > 0n ? <LockIcon className="size-3 text-locked" /> : null}
                      {formatQty(a.owned, 4)} {a.ticker}
                    </span>
                  </>
                ) : (
                  <span className="num block font-bold">{a.priceUsd ? formatUsd(a.priceUsd) : "—"}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
