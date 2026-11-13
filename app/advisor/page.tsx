import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { formatUsd } from "@/app/_lib/format";
import { getAdvisorEnabled, loadAdvisor } from "@/app/_server/advisor";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { AdvisorSwitch } from "./advisor-switch";
import { AdvisorView } from "./advisor-view";
import { LoadingBlock } from "@/app/_components/spinner";

export const metadata: Metadata = { title: "Advisor · Stow" };

export default function AdvisorPage() {
  return (
    <AppShell active="/advisor">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-text-muted">Ideas to save more and stay on budget, only if you approve</p>
          <h1 className="display text-[calc(28px*var(--fs))] leading-tight sm:text-[32px]">Advisor</h1>
        </header>
        <Suspense fallback={<LoadingBlock label="Loading the advisor" className="h-[520px] rounded-[20px]" />}>
          <AdvisorContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function AdvisorContent() {
  await connection();
  const engine = getEngine();
  let data: Awaited<ReturnType<typeof loadAdvisor>> | null = null;
  try {
    const user = await getCurrentUser(engine);
    // Switched off: skip the suggestions (and their Gateway calls) entirely.
    if (await getAdvisorEnabled(user.id)) data = await loadAdvisor(engine, user);
  } catch (err) {
    const f = gatewayFailure(engine, err);
    return <GatewayErrorCard reason={f.reason} mode={f.mode} requestId={f.requestId} />;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <AdvisorSwitch enabled={false} />
        <p className="rounded-[20px] border border-dashed border-border bg-surface-raised p-6 text-sm text-text-muted">
          The Advisor is off. Your savings goals and budgets work exactly the same without it. Switch it back on any time to get
          suggestions again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdvisorSwitch enabled />
      <AdvisorView profile={data.profile} suggestions={data.suggestions} />

      <section aria-labelledby="rules-title" className="rounded-[20px] bg-surface-raised p-5 text-sm sm:p-6">
        <h2 id="rules-title" className="font-bold">
          How the advisor works
        </h2>
        <ul className="mt-2 space-y-1.5 text-text-muted">
          <li>It only suggests. Nothing happens until you tap Approve.</li>
          <li>Approved suggestions go through the same signing guard as you: it can never touch locked money or break your limits.</li>
          <li>Every suggestion says why, in plain words, and what it would change.</li>
          <li>No leverage, ever.</li>
        </ul>
      </section>

      <section aria-labelledby="log-title">
        <h2 id="log-title" className="display mb-3 text-xl">
          Advisor&apos;s decision log
        </h2>
        {data.log.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-border bg-surface-raised p-6 text-center text-sm text-text-muted">
            No approved suggestions yet.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface-raised">
            {data.log.map((e) => (
              <li key={`${e.at.getTime()}-${e.assetId}`} className="flex items-start justify-between gap-3 px-5 py-3.5 text-sm">
                <div>
                  <p className="font-bold">
                    {e.kind === "buy" ? "Buy" : e.kind === "sell" ? "Sell" : "Send"} {data.tickers[e.symbol] ?? e.symbol} · {formatUsd(e.notionalUsd)}
                  </p>
                  <p className="text-text-muted">
                    {e.outcome === "blocked" ? `Not signed: ${e.violations[0]?.message ?? "a rule said no"}` : e.outcome === "failed" ? "Failed" : "Done, under your rules"}
                  </p>
                </div>
                <time dateTime={e.at.toISOString()} className="num shrink-0 text-xs text-text-muted">
                  {e.at.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
