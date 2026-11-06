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
import { TradePanel } from "./trade-panel";

export const metadata: Metadata = { title: "Invest · Portfolio Vault" };

export default function AssetPage({ params }: PageProps<"/invest/[assetId]">) {
  return (
    <AppShell active="/invest">
      <div className="mx-auto max-w-3xl">
        <Link href="/invest" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text">
          ← Invest
        </Link>
        <Suspense fallback={<div aria-busy aria-label="Loading" className="h-[520px] animate-pulse rounded-[24px] bg-border/60" />}>
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
  const { asset, paying } = found;
  const hasPosition = dec(asset.owned) > 0n;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] bg-frame p-6 text-frame-text sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-hero text-xs font-extrabold text-white" aria-hidden>
            {asset.ticker.slice(0, 4)}
          </span>
          <div>
            <h1 className="display text-2xl leading-tight">{asset.name}</h1>
            <p className="text-sm text-frame-muted">
              {asset.ticker} · {asset.assetClass === "stock" ? "Tokenized stock" : "Crypto"} on {networkLabel(asset.chain)}
            </p>
          </div>
        </div>
        <p className="num display mt-6 text-[40px] leading-none">{asset.priceUsd ? formatUsd(asset.priceUsd) : "—"}</p>
        <p className="mt-1 text-sm text-frame-muted">{asset.assetClass === "stock" ? "per share" : `per ${asset.ticker}`}, live quote</p>

        {hasPosition ? (
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
            <Stat label="You own" value={`${formatQty(asset.owned, 6)}`} sub={formatUsd(asset.valueUsd)} />
            <Stat label="Locked" value={formatQty(asset.locked, 6)} sub={dec(asset.locked) > 0n ? "Can't be sold" : "—"} />
            <Stat label="Free to sell" value={formatQty(asset.free, 6)} sub={asset.ticker} />
          </dl>
        ) : null}
      </section>

      <TradePanel asset={asset} paying={paying} />

      {asset.assetClass === "stock" ? (
        <p className="px-1 text-xs leading-relaxed text-text-muted">
          A tokenized stock is a token that tracks the share price, issued on {networkLabel(asset.chain)} and bought through True Markets.
          Prices move; you can lose money. Availability depends on your country.
        </p>
      ) : null}
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
