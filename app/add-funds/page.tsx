import type { Metadata } from "next";
import { connection } from "next/server";
import QRCode from "qrcode";
import { Suspense } from "react";
import type { Asset, Wallet } from "@/engine";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { chainFamily, networkLabel, type ChainFamily } from "@/app/_lib/address";
import { cashFor, isInvestable, SUPPORTED_CHAINS } from "@/app/_lib/catalog-policy";
import { getCurrentUser, getWallets } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { CopyButton } from "./copy-button";
import { PracticeFundsButton } from "./practice-funds-button";

export const metadata: Metadata = { title: "Add funds · Portfolio Vault" };

// Which networks each wallet covers comes from the live asset catalog, not a hard-coded list:
// one Solana address, and one EVM address that is the same on every EVM chain True Markets supports.
function describe(family: ChainFamily, chains: string[]): { name: string; note: string } {
  if (family === "solana") return { name: "Solana", note: "Fast and cheap. Most exchanges can send USDC on Solana." };
  const names = chains.map(networkLabel).join(" and ") || "EVM";
  return {
    name: names,
    note: `An Ethereum-style (0x) address. Use it on ${names} only; that's where your assets settle.`,
  };
}

export default function AddFundsPage() {
  return (
    <AppShell active="/">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-text-muted">From any wallet or exchange</p>
          <h1 className="display text-[28px] leading-tight sm:text-[32px]">Add funds</h1>
        </header>
        <Suspense fallback={<div aria-busy aria-label="Loading your addresses" className="h-[480px] animate-pulse rounded-[24px] bg-border/60" />}>
          <AddFundsContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function AddFundsContent() {
  await connection();
  const engine = getEngine();
  let wallets: Wallet[];
  let assets: Asset[];
  try {
    const user = await getCurrentUser(engine);
    [wallets, assets] = await Promise.all([getWallets(engine, user), engine.client.listAssets({ asset_class: "crypto" })]);
  } catch (err) {
    const f = gatewayFailure(engine, err);
    return <GatewayErrorCard reason={f.reason} mode={f.mode} requestId={f.requestId} />;
  }
  const practice = engine.config.mode === "mock";

  const cards = await Promise.all(
    wallets.map(async (w) => {
      const family = w.chain_family;
      // What's worth depositing here: each network's cash stablecoin, plus approved crypto on it.
      const chains = SUPPORTED_CHAINS.filter((c) => chainFamily(c) === family);
      const cash = chains.map((c) => cashFor(assets, c)).filter((a): a is Asset => Boolean(a));
      const accepted = [...cash, ...assets.filter((a) => isInvestable(a) && a.asset_class !== "stock" && chainFamily(a.chain) === family)];
      const svg = await QRCode.toString(w.address, { type: "svg", margin: 1, color: { dark: "#060f21", light: "#ffffff" } });
      const acceptedChains = [...new Set(accepted.map((a) => a.chain!).filter(Boolean))];
      return { wallet: w, family, accepted, svg, net: describe(family, acceptedChains) };
    }),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {cards.filter((c) => c.accepted.length > 0).map(({ wallet, family, accepted, svg, net }) => (
          <section key={wallet.address} aria-labelledby={`net-${family}`} className="flex flex-col rounded-[24px] border border-border bg-surface-raised p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id={`net-${family}`} className="display text-xl">
                {net.name}
              </h2>
              <span className="rounded-full bg-hero/15 px-3 py-1 text-xs font-bold text-hero">Your deposit address</span>
            </div>
            <p className="mt-1 text-sm text-text-muted">{net.note}</p>

            <div
              className="mx-auto mt-5 size-44 rounded-2xl bg-white p-2 [&>svg]:size-full"
              role="img"
              aria-label={`QR code of your ${net.name} address`}
              // The SVG comes from the qrcode library, generated from our own address string.
              dangerouslySetInnerHTML={{ __html: svg }}
            />

            <p className="mt-5 rounded-xl bg-surface px-3 py-3 text-center font-mono text-sm break-all select-all">{wallet.address}</p>
            <div className="mt-3 flex justify-center">
              <CopyButton text={wallet.address} />
            </div>

            <div className="mt-5 rounded-2xl bg-warning-bg p-4 text-sm">
              <p className="font-bold text-warning">Only send {accepted.map((a) => a.symbol).join(" or ")} on {net.name}</p>
              <p className="mt-1 text-text">Other coins, or the right coin on a different network, may be lost for good.</p>
            </div>

            {practice ? (
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                {accepted
                  .filter((a) => a.symbol === "USDC" || a.symbol === "SOL")
                  .map((a) => (
                    <PracticeFundsButton key={a.id} assetId={a.id} label={`+ ${a.symbol === "USDC" ? "100" : "1"} practice ${a.symbol}`} />
                  ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <section className="rounded-[20px] border border-dashed border-border bg-surface-raised p-5 text-sm">
        <h2 className="font-bold">From a bank account</h2>
        <p className="mt-1 text-text-muted">Coming soon: pay in by bank transfer and receive USDC. Tokenized stocks are bought inside the app.</p>
      </section>
    </div>
  );
}
