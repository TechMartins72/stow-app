import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { dec } from "@/engine/decimal";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { networkLabel } from "@/app/_lib/address";
import { formatQty, formatUsd } from "@/app/_lib/format";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { loadMarketAsset } from "@/app/_server/market";
import { AssetLogo } from "@/app/_components/asset-logo";
import { ChangePill } from "@/app/_components/price-bits";
import { cleanDescription } from "@/app/_lib/catalog-policy";
import { PriceChart } from "./price-chart";
import { TradePanel } from "./trade-panel";
import { LoadingBlock } from "@/app/_components/spinner";

export const metadata: Metadata = { title: "Invest · Stow" };

export default function AssetPage({ params }: PageProps<"/invest/[assetId]">) {
  return (
    <AppShell active="/invest">
      <div className="mx-auto max-w-3xl">
        <Link href="/invest" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text">
          ← Invest
        </Link>
        <Suspense fallback={<LoadingBlock label="Loading prices" className="h-[520px] rounded-[24px]" />}>
          <AssetDetail params={params} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function AssetDetail({ params }: Pick<PageProps<"/invest/[assetId]">, "params">) {
  await connection();
  const { assetId } = await params;
  const engine = getEngine();
  let found;
  try {
    found = await loadMarketAsset(engine, await getCurrentUser(engine), assetId);
  } catch (err) {
    const f = gatewayFailure(engine, err);
    return <GatewayErrorCard reason={f.reason} mode={f.mode} requestId={f.requestId} />;
  }
  if (!found) notFound();
  const { asset, paying, chart } = found;
  const hasPosition = dec(asset.owned) > 0n;
  const about = cleanDescription(asset.description, asset.name);

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] bg-frame p-6 text-frame-text sm:p-8">
        <div className="flex items-center gap-3">
          <AssetLogo icon={asset.icon} ticker={asset.ticker} size={48} />
          <div className="min-w-0">
            <h1 className="display text-2xl leading-tight">{asset.name}</h1>
            <p className="text-sm text-frame-muted">
              {asset.ticker} · {asset.assetClass === "stock" ? "Tokenized stock" : "Crypto"} on {networkLabel(asset.chain)}
            </p>
          </div>
          {asset.tradability === "sell_only" ? (
            <span className="ml-auto shrink-0 rounded-full bg-warning-bg px-3 py-1 text-xs font-bold text-warning">Sell only</span>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="num display text-[calc(40px*var(--fs))] leading-none">{asset.priceUsd ? formatUsd(asset.priceUsd) : "—"}</p>
          {asset.change24h ? (
            <span className="rounded-full bg-white/10 px-2.5 py-1">
              <ChangePill pct={asset.change24h.pct} direction={asset.change24h.direction} />
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-frame-muted">{asset.assetClass === "stock" ? "per share" : `per ${asset.ticker}`}, live market price · 24h change</p>

        {hasPosition ? (
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
            <Stat label="You own" value={`${formatQty(asset.owned, 6)}`} sub={formatUsd(asset.valueUsd)} />
            <Stat label="Locked" value={formatQty(asset.locked, 6)} sub={dec(asset.locked) > 0n ? "Can't be sold" : "—"} />
            <Stat label="Free to sell" value={formatQty(asset.free, 6)} sub={asset.ticker} />
          </dl>
        ) : null}
      </section>

      <PriceChart assetId={asset.assetId} initial={chart} />

      {asset.tradability === "sell_only" ? (
        <p role="note" className="rounded-2xl bg-warning-bg p-4 text-sm">
          <span className="font-bold text-warning">New buys are paused for {asset.name}.</span> You can still sell any free shares you own.
        </p>
      ) : null}

      <TradePanel asset={asset} paying={paying} />

      {about ? (
        <section aria-labelledby="about-title" className="rounded-[20px] bg-surface-raised p-5 sm:p-6">
          <h2 id="about-title" className="font-bold">
            About {asset.name}
          </h2>
          {about.split(/\n\n/).map((p) => (
            <p key={p.slice(0, 40)} className="mt-2 text-sm leading-relaxed text-text-muted">
              {p}
            </p>
          ))}
          {asset.website ? (
            <a href={asset.website} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              Learn more ↗
            </a>
          ) : null}
        </section>
      ) : null}

      <p className="px-1 text-xs leading-relaxed text-text-muted">
        {asset.assetClass === "stock"
          ? `A tokenized stock is a token that tracks the share price, issued on ${networkLabel(asset.chain)} and bought through True Markets. `
          : ""}
        Prices move; you can lose money. Availability depends on your country. Not financial advice.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="text-xs text-frame-muted">{label}</dt>
      <dd className="num mt-0.5 font-bold">{value}</dd>
      <dd className="num text-xs text-frame-muted">{sub}</dd>
    </div>
  );
}
