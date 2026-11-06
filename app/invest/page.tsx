import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { loadMarket } from "@/app/_server/market";
import { MarketList } from "./market-list";

export const metadata: Metadata = { title: "Invest · Portfolio Vault" };

export default function InvestPage() {
  return (
    <AppShell active="/invest">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-text-muted">Tokenized stocks and crypto, paid in USDC</p>
          <h1 className="display text-[28px] leading-tight sm:text-[32px]">Invest</h1>
        </header>
        <Suspense fallback={<div aria-busy aria-label="Loading the market" className="h-[520px] animate-pulse rounded-[20px] bg-border/60" />}>
          <Market />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function Market() {
  await connection();
  const engine = getEngine();
  let assets;
  try {
    assets = await loadMarket(engine, await getCurrentUser(engine));
  } catch (err) {
    const f = gatewayFailure(engine, err);
    return <GatewayErrorCard reason={f.reason} mode={f.mode} requestId={f.requestId} />;
  }
  return <MarketList assets={assets} />;
}
