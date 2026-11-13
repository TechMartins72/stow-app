import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { chainFamily } from "@/app/_lib/address";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { loadHoldings } from "@/app/_server/wallet";
import { WithdrawFlow } from "./withdraw-flow";
import { LoadingBlock } from "@/app/_components/spinner";

export const metadata: Metadata = { title: "Withdraw · Stow" };

export default function WithdrawPage({ searchParams }: PageProps<"/withdraw">) {
  return (
    <AppShell active="/">
      <div className="mx-auto max-w-xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-text-muted">Send to another wallet</p>
          <h1 className="display text-[calc(28px*var(--fs))] leading-tight sm:text-[32px]">Withdraw</h1>
        </header>
        <Suspense fallback={<LoadingBlock label="Loading your balances" className="h-[420px] rounded-[24px]" />}>
          <WithdrawLoader searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function WithdrawLoader({ searchParams }: Pick<PageProps<"/withdraw">, "searchParams">) {
  await connection();
  const engine = getEngine();
  const params = await searchParams;
  let holdings;
  try {
    const user = await getCurrentUser(engine);
    const [all, crypto] = await Promise.all([loadHoldings(engine, user), engine.client.listAssets({ asset_class: "crypto" })]);
    // Crypto only for now; see withdraw/actions.ts.
    holdings = all.filter((h) => crypto.some((a) => a.id === h.assetId));
  } catch (err) {
    const f = gatewayFailure(engine, err);
    return <GatewayErrorCard reason={f.reason} mode={f.mode} requestId={f.requestId} />;
  }

  if (!holdings.some((h) => chainFamily(h.chain))) {
    return (
      <div className="rounded-[20px] border border-border bg-surface-raised p-6">
        <h2 className="display text-2xl">Nothing to send yet</h2>
        <p className="mt-2 text-text-muted">Your wallet is empty. Add funds first.</p>
        <Link href="/add-funds" className="mt-5 inline-block rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white">
          Add funds
        </Link>
      </div>
    );
  }

  return <WithdrawFlow holdings={holdings} initialAssetId={typeof params.asset === "string" ? params.asset : undefined} />;
}
