import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard, NoLocksCard } from "@/app/_components/home-sections";
import { LockIcon, PadlockMotif, PlusIcon } from "@/app/_components/icons";
import { LockCard } from "@/app/_components/lock-card";
import { formatDate, formatQty, formatUsd } from "@/app/_lib/format";
import { loadVault } from "@/app/_server/vault";

export const metadata: Metadata = { title: "Vault · Portfolio Vault" };

export default function VaultPage() {
  return (
    <AppShell active="/vault">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text-muted">Every promise in one place</p>
            <h1 className="display text-[28px] leading-tight sm:text-[32px]">Vault</h1>
          </div>
          <Link
            href="/vault/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <PlusIcon className="size-4" /> New lock
          </Link>
        </header>
        <Suspense fallback={<VaultSkeleton />}>
          <VaultContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function VaultContent() {
  await connection();
  const result = await loadVault();
  if (!result.ok) return <GatewayErrorCard reason={result.reason} mode={result.mode} requestId={result.requestId} />;
  const { active, finished, totalLockedUsd, nextRelease } = result.data;
  const now = new Date();

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[24px] bg-locked p-6 text-white sm:p-8">
        <PadlockMotif className="pointer-events-none absolute -right-10 -bottom-14 size-64 text-white/10" />
        <p className="relative text-sm font-semibold text-white/80">Locked right now</p>
        <p className="num display relative mt-1 text-[40px] leading-none">{formatUsd(totalLockedUsd)}</p>
        <p className="relative mt-4 text-sm text-white/85">
          {nextRelease
            ? `Next release: ${formatQty(nextRelease.amount)} ${nextRelease.lock.symbol} from “${nextRelease.lock.goalName}” on ${formatDate(nextRelease.releaseAt)}.`
            : "Nothing locked at the moment."}
        </p>
      </section>

      <section aria-labelledby="active-title">
        <h2 id="active-title" className="display mb-3 text-xl">
          Active locks <span className="num text-text-muted">· {active.length}</span>
        </h2>
        {active.length === 0 ? (
          <NoLocksCard />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((lock) => (
              <LockCard key={lock.id} lock={lock} now={now} />
            ))}
          </div>
        )}
      </section>

      {finished.length > 0 ? (
        <section aria-labelledby="finished-title">
          <h2 id="finished-title" className="display mb-3 text-xl">
            Released <span className="num text-text-muted">· {finished.length}</span>
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface-raised">
            {finished.map((lock) => (
              <li key={lock.id}>
                <Link href={`/vault/${lock.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-surface">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-positive/15 text-positive" aria-hidden>
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{lock.goalName}</span>
                    <span className="num block text-sm text-text-muted">
                      {formatQty(lock.amount)} {lock.symbol} · fully released {formatDate(lock.unlockAt)}
                    </span>
                  </span>
                  <LockIcon className="size-4 text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function VaultSkeleton() {
  return (
    <div aria-busy aria-label="Loading your locks" className="space-y-8">
      <div className="h-[170px] animate-pulse rounded-[24px] bg-locked/40" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-[20px] bg-border/60" />
        <div className="h-48 animate-pulse rounded-[20px] bg-border/60" />
      </div>
    </div>
  );
}
