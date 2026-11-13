import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { LockIcon, PadlockMotif } from "@/app/_components/icons";
import { countdown, formatDate, formatQty, formatUsd, lockProgress } from "@/app/_lib/format";
import { loadLock } from "@/app/_server/vault";
import { dec, ZERO } from "@/engine/decimal";
import { WithdrawFreeLink } from "./withdraw-free-link";
import { LoadingBlock } from "@/app/_components/spinner";

export const metadata: Metadata = { title: "Lock · Stow" };

export default function LockDetailPage({ params }: PageProps<"/vault/[id]">) {
  return (
    <AppShell active="/vault">
      <div className="mx-auto max-w-3xl">
        <Link href="/vault" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text">
          ← Vault
        </Link>
        <Suspense fallback={<LoadingBlock label="Loading your plan" className="h-[420px] rounded-[24px]" />}>
          <LockDetail params={params} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function LockDetail({ params }: Pick<PageProps<"/vault/[id]">, "params">) {
  await connection();
  const { id } = await params;
  const result = await loadLock(id);
  if (!result.ok) return <GatewayErrorCard reason={result.reason} mode={result.mode} requestId={result.requestId} />;
  const lock = result.lock;
  if (!lock) notFound();

  const now = new Date();
  const scheduled = lock.parts > 1;
  const next = lock.next ? countdown(lock.next.releaseAt, now) : null;
  // Scheduled: share of the money released. One date: share of the waiting done.
  const pct = Math.round((scheduled || lock.finished ? lock.releasedShare : lockProgress(lock.createdAt, lock.unlockAt, now)) * 100);
  const pctLabel = scheduled || lock.finished ? `${pct}% released` : `${pct}% of the wait done`;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <section className="relative overflow-hidden rounded-[24px] bg-locked p-6 text-white sm:p-8">
        <PadlockMotif className="pointer-events-none absolute -right-10 -bottom-14 size-64 text-white/10" />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            {scheduled ? `Released in ${lock.parts} parts` : "Unlocks all at once"}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-locked">
            {lock.finished ? "Fully released" : next ? `Next release in ${next.label}` : "Locked"}
          </span>
        </div>
        <h1 className="display relative mt-4 text-[calc(30px*var(--fs))] leading-tight sm:text-[36px]">{lock.goalName}</h1>
        <p className="num relative mt-2 text-lg font-semibold">
          {lock.finished ? (
            <>All {formatQty(lock.amount)} {lock.symbol} is free to use</>
          ) : (
            <>
              {formatQty(lock.lockedAmount)} {lock.symbol} still locked <span className="text-white/75">of {formatQty(lock.amount)}</span>
            </>
          )}
        </p>
        <div className="relative mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/20" role="img" aria-label={pctLabel}>
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <p className="num mt-2 text-sm text-white/85">{pctLabel}</p>
        </div>
      </section>

      {/* Facts */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Locked now" value={formatUsd(lock.lockedUsd)} />
        <Fact label="Whole lock today" value={formatUsd(lock.valueUsd)} />
        <Fact label="Created" value={formatDate(lock.createdAt)} />
        <Fact label={lock.finished ? "Finished" : "Fully free on"} value={formatDate(lock.unlockAt)} />
      </dl>

      {/* Schedule */}
      <section aria-labelledby="schedule-title" className="rounded-[20px] border border-border bg-surface-raised p-5 sm:p-6">
        <h2 id="schedule-title" className="display text-xl">
          {scheduled ? "Release schedule" : "Unlock date"}
        </h2>
        <ol className="mt-4">
          {lock.schedule.map((part, i) => {
            const left = countdown(part.releaseAt, now);
            const isNext = !part.released && lock.next?.releaseAt.getTime() === part.releaseAt.getTime();
            return (
              <li key={part.releaseAt.toISOString()} className="relative flex gap-4 pb-5 last:pb-0">
                {i < lock.schedule.length - 1 ? (
                  <span className={`absolute top-8 bottom-0 left-[15px] w-0.5 ${part.released ? "bg-positive/40" : "bg-border"}`} aria-hidden />
                ) : null}
                <span
                  className={`relative z-[1] grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    part.released ? "bg-positive text-white" : isNext ? "bg-locked text-white" : "bg-border text-text-muted"
                  }`}
                  aria-hidden
                >
                  {part.released ? "✓" : <LockIcon className="size-4" />}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 pt-1">
                  <div>
                    <p className="font-bold">{formatDate(part.releaseAt)}</p>
                    <p className="text-sm text-text-muted">{part.released ? "Released, free to use" : isNext ? `Next, in ${left.label}` : `In ${left.label}`}</p>
                  </div>
                  <p className="num font-bold">
                    {formatQty(part.amount)} {lock.symbol}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Rules */}
      <section className="rounded-[20px] bg-surface-raised p-5 text-sm sm:p-6">
        <h2 className="font-bold">How this lock works</h2>
        <ul className="mt-2 space-y-1.5 text-text-muted">
          <li>Until each date, the app refuses to withdraw, sell or trade that part, even if you ask. So does the advisor.</li>
          <li>On its date, each part becomes free to use automatically. No button needed.</li>
          <li>No money moved when you created it; the app only stops it from leaving.</li>
          <li>Early exit isn&apos;t available.</li>
        </ul>
        <WithdrawFreeLink
          assetId={lock.assetId}
          symbol={lock.symbol}
          hasFree={dec(result.freeAmount) > ZERO}
          nextFreeNote={
            lock.next
              ? `All of it is held by your savings goals and budgets. ${formatQty(lock.next.amount)} ${lock.symbol} frees up on ${formatDate(lock.next.releaseAt)}.`
              : `Your wallet has no ${lock.symbol} outside your savings goals and budgets.`
          }
        />
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-4">
      <dt className="text-xs font-semibold text-text-muted">{label}</dt>
      <dd className="num mt-1 font-bold">{value}</dd>
    </div>
  );
}
