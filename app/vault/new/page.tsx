import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { StowMark } from "@/app/_components/icons";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { loadLockable } from "@/app/_server/wallet";
import { NewLockWizard } from "./new-lock-wizard";
import { LoadingNote } from "@/app/_components/spinner";

export const metadata: Metadata = { title: "New plan · Stow" };

/** A focused flow: no main nav, just a way out. */
export default function NewLockPage() {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between bg-frame px-4 py-3 text-frame-text sm:px-6">
        <div className="flex items-center gap-2.5">
          <StowMark className="size-8" />
          <span className="display text-lg">New savings goal or budget</span>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-frame-raised focus-visible:outline-2 focus-visible:outline-hero"
        >
          Cancel
        </Link>
      </header>
      <main className="px-4 pt-8 pb-16 sm:px-6">
        <Suspense fallback={<WizardSkeleton />}>
          <WizardLoader />
        </Suspense>
      </main>
    </div>
  );
}

async function WizardLoader() {
  await connection();
  const engine = getEngine();
  let assets;
  try {
    assets = await loadLockable(engine, await getCurrentUser(engine));
  } catch (err) {
    const failure = gatewayFailure(engine, err);
    return (
      <div className="mx-auto max-w-xl">
        <GatewayErrorCard
          reason={failure.reason}
          mode={failure.mode}
          requestId={failure.requestId}
        />
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-[20px] border border-border bg-surface-raised p-6">
        <h2 className="display text-2xl">Nothing to lock yet</h2>
        <p className="mt-2 text-text-muted">
          Everything you hold is already locked, or your wallet is empty. Add
          funds first.
        </p>
        <div className="flex gap-4">
          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white"
          >
            Back to Home
          </Link>
          <Link
            href="/add-funds"
            className="mt-5 inline-block rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white"
          >
            Deposit
          </Link>
        </div>
      </div>
    );
  }

  return <NewLockWizard assets={assets} nowIso={new Date().toISOString()} />;
}

function WizardSkeleton() {
  return (
    <div aria-busy aria-label="Loading what you can put away" className="mx-auto max-w-xl space-y-3">
      <LoadingNote label="Loading what you can put away" />
      <div className="mb-8 h-6 animate-pulse rounded-full bg-border/60" />
      <div className="h-9 w-2/3 animate-pulse rounded-xl bg-border/60" />
      <div className="h-[72px] animate-pulse rounded-2xl bg-border/60" />
      <div className="h-[72px] animate-pulse rounded-2xl bg-border/60" />
      <div className="h-[72px] animate-pulse rounded-2xl bg-border/60" />
    </div>
  );
}
