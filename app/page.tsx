import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "./_components/app-shell";
import { BalanceHero } from "./_components/balance-hero";
import {
  AdvisorCard,
  FirstDepositCard,
  GatewayErrorCard,
  HomeSkeleton,
  NoLocksCard,
  QuickActions,
  SectionHeading,
} from "./_components/home-sections";
import { LockCard } from "./_components/lock-card";
import { formatUsd } from "./_lib/format";
import { loadHome } from "./_server/home";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <AppShell active="/">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-text-muted">Welcome back</p>
          <h1 className="display text-[28px] leading-tight sm:text-[32px]">Your savings</h1>
        </header>
        <Suspense fallback={<HomeSkeleton />}>
          <HomeContent searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function HomeContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection(); // Balances and countdowns are per request.
  const [result, params] = await Promise.all([loadHome(), searchParams]);
  const justLocked = typeof params.locked === "string" ? params.locked : undefined;
  if (!result.ok) return <GatewayErrorCard reason={result.reason} mode={result.mode} requestId={result.requestId} />;

  const { data } = result;
  const practice = data.mode === "mock";
  const now = new Date();

  if (data.holdings.length === 0) return <FirstDepositCard practice={practice} />;

  return (
    <div className="space-y-8">
      <BalanceHero
        total={formatUsd(data.totalUsd)}
        locked={formatUsd(data.lockedUsd)}
        accessible={formatUsd(data.accessibleUsd)}
        lockedPercent={data.lockedBps / 100}
        practice={practice}
      />

      <QuickActions />

      <section aria-labelledby="locks-title">
        <SectionHeading id="locks-title" title="Your locks" action={{ label: "See all", href: "/vault" }} />
        {data.locks.length === 0 ? (
          <NoLocksCard />
        ) : (
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
            {data.locks.map((lock) => (
              <LockCard key={lock.id} lock={lock} now={now} highlight={lock.id === justLocked} />
            ))}
          </div>
        )}
      </section>

      <AdvisorCard />
    </div>
  );
}
