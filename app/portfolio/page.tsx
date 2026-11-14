import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { PlusIcon } from "@/app/_components/icons";
import { LoadingBlock } from "@/app/_components/spinner";
import { formatUsd } from "@/app/_lib/format";
import { loadPortfolio } from "@/app/_server/portfolio";
import { Breakdown, HoldingCard, PortfolioHero } from "./portfolio-parts";

export const metadata: Metadata = { title: "Portfolio · Stow" };

export default function PortfolioPage() {
  return (
    <AppShell active="/portfolio">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-text-muted">Everything you hold, in detail</p>
          <h1 className="display text-[calc(28px*var(--fs))] leading-tight sm:text-[32px]">Portfolio</h1>
        </header>
        <Suspense fallback={<LoadingBlock label="Loading your portfolio" className="h-[520px] rounded-[24px]" />}>
          <PortfolioContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function PortfolioContent() {
  await connection(); // Balances and prices are per request.
  const result = await loadPortfolio();
  if (!result.ok) return <GatewayErrorCard reason={result.reason} mode={result.mode} requestId={result.requestId} />;
  const data = result.data;

  if (data.holdings.length === 0) {
    return (
      <section className="rounded-[24px] border border-dashed border-border bg-surface-raised p-8 text-center">
        <h2 className="display text-2xl">Nothing here yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
          Add dollars (USDC) or crypto to your wallet, and every coin and stock you hold will show up here with its value and what&apos;s
          locked.
        </p>
        <Link href="/add-funds" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-[22px] py-[13px] font-semibold text-white hover:bg-primary-hover">
          <PlusIcon className="size-5" /> Add funds
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <PortfolioHero data={data} />

      <div className="grid gap-4 md:grid-cols-2">
        <Breakdown
          title="By type"
          slices={data.byBucket.map((s) => ({ label: s.label, valueUsd: s.valueUsd, bps: s.bps, tone: s.bucket }))}
        />
        <Breakdown
          title="By network"
          slices={data.byNetwork.map((n, i) => ({ label: n.label, valueUsd: n.valueUsd, bps: n.bps, tone: i === 0 ? "cash" : i === 1 ? "crypto" : "stocks" }))}
        />
      </div>

      <section aria-labelledby="holdings-title">
        <h2 id="holdings-title" className="display mb-3 text-xl">
          Your holdings <span className="num text-text-muted">· {data.holdings.length}</span>
        </h2>
        <ul className="space-y-4">
          {data.holdings.map((h) => (
            <li key={h.assetId}>
              <HoldingCard h={h} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-text-muted">
          Values use live prices from True Markets; the 24-hour change uses market data and is for information. Total {formatUsd(data.totalUsd)}.
        </p>
      </section>
    </div>
  );
}
