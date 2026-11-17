import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "./_components/app-shell";
import { BalanceHero } from "./_components/balance-hero";
import {
  AccountSummary,
  ComingUp,
  HoldingsList,
  LearnCard,
  MarketMovers,
  RecentActivity,
  VaultSnippet,
} from "./_components/home-panels";
import {
  AdvisorCard,
  FirstDepositCard,
  GatewayErrorCard,
  HomeSkeleton,
  QuickActions,
} from "./_components/home-sections";
import { formatUsd } from "./_lib/format";
import { loadHome } from "./_server/home";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <AppShell active="/">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-text-muted">Welcome back</p>
          <h1 className="display text-[calc(28px*var(--fs))] leading-tight sm:text-[32px]">
            Your savings &amp; budgets
          </h1>
        </header>
        <Suspense fallback={<HomeSkeleton />}>
          <HomeContent searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function HomeContent({
  searchParams,
}: Pick<PageProps<"/">, "searchParams">) {
  await connection(); // Balances and countdowns are per request.
  const [result, params] = await Promise.all([loadHome(), searchParams]);
  const justLocked =
    typeof params.locked === "string" ? params.locked : undefined;
  if (!result.ok)
    return (
      <GatewayErrorCard
        reason={result.reason}
        mode={result.mode}
        requestId={result.requestId}
      />
    );

  const { data } = result;
  const practice = data.mode === "mock";
  const now = new Date();
  const funded = data.holdings.length > 0;

  return (
    <div className="space-y-6">
      {funded ? (
        <BalanceHero
          total={formatUsd(data.totalUsd)}
          locked={formatUsd(data.lockedUsd)}
          accessible={formatUsd(data.accessibleUsd)}
          lockedPercent={data.lockedBps / 100}
          practice={practice}
        />
      ) : (
        // New = no history at all. If the history didn't load, don't guess: plain "Add funds".
        <FirstDepositCard
          practice={practice}
          firstTime={data.activity !== null && data.activity.length === 0}
        />
      )}

      <QuickActions />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-8">
          {funded ? (
            <AccountSummary
              slices={data.allocation}
              assetCount={data.holdings.length}
              lockCount={data.locks.length}
              next={data.upcoming[0]}
            />
          ) : null}

          <VaultSnippet
            locks={data.locks}
            counts={data.vault}
            lockedUsd={data.lockedUsd}
            now={now}
            highlight={justLocked}
          />

          {funded ? <HoldingsList holdings={data.holdings} /> : null}

          <MarketMovers movers={data.movers} />

          <RecentActivity items={data.activity} />
        </div>

        <aside className="space-y-6" aria-label="At a glance">
          {data.locks.length > 0 ? (
            <ComingUp releases={data.upcoming} now={now} />
          ) : null}
          <LearnCard />
          {data.advisorEnabled ? <AdvisorCard /> : null}
        </aside>
      </div>
    </div>
  );
}
