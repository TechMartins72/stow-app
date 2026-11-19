import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/app/_components/app-shell";
import { GatewayErrorCard } from "@/app/_components/home-sections";
import { LoadingBlock } from "@/app/_components/spinner";
import { networkLabel } from "@/app/_lib/address";
import { deletionCheck, signedInRecently } from "@/app/_lib/account-deletion";
import { formatDate, formatQty, formatUsd } from "@/app/_lib/format";
import { getCurrentUser } from "@/app/_server/current-user";
import { getEngine } from "@/app/_server/engine";
import { gatewayFailure } from "@/app/_server/gateway-failure";
import { readSession } from "@/app/_server/session";
import { loadHoldings } from "@/app/_server/wallet";
import { signInAgainAction } from "./actions";
import { DeleteForm } from "./delete-form";

export const metadata: Metadata = { title: "Delete account · Stow" };

export default function DeleteAccountPage() {
  return (
    <AppShell active="">
      <div className="mx-auto max-w-xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-text-muted">Your account</p>
          <h1 className="display text-[calc(28px*var(--fs))] leading-tight sm:text-[32px]">
            Delete account
          </h1>
        </header>
        <Suspense
          fallback={
            <LoadingBlock
              label="Checking your wallets"
              className="h-[360px] rounded-[24px]"
            />
          }
        >
          <DeleteLoader />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function DeleteLoader() {
  await connection();
  const engine = getEngine();
  let email: string;
  let check;
  let recent: boolean;
  try {
    const [session, user] = await Promise.all([
      readSession(),
      getCurrentUser(engine),
    ]);
    email = user.email;
    recent = !!session && signedInRecently(session.signedInAt, new Date());
    check = deletionCheck(await loadHoldings(engine, user));
  } catch (err) {
    const f = gatewayFailure(engine, err);
    return (
      <GatewayErrorCard
        reason={f.reason}
        mode={f.mode}
        requestId={f.requestId}
      />
    );
  }

  if (!check.ok && check.reason === "locked") {
    return (
      <Card tone="blocked" title="Your plans are still running">
        <p>
          Some of your money is locked, so your account can&apos;t be deleted
          yet. Deleting it would be a way round your own plans, and Stow
          doesn&apos;t do that. You can delete your account once these have
          freed up and you&apos;ve withdrawn the money.
        </p>
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {check.plans.map((p, i) => (
            <li
              key={`${p.goalName}${i}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold text-text">
                  {p.goalName}
                </span>
                <span className="num block text-sm">
                  {formatQty(p.amount, 6)} {p.symbol} locked
                </span>
              </span>
              {p.until ? (
                <span className="num shrink-0 text-sm font-semibold text-text">
                  Next release {formatDate(p.until)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <Link
          href="/vault"
          className="mt-5 inline-block rounded-xl bg-primary px-[22px] py-[13px] font-semibold text-white hover:bg-primary-hover"
        >
          See your plans
        </Link>
      </Card>
    );
  }

  if (!check.ok) {
    return (
      <Card tone="blocked" title="Withdraw your money first">
        <p>
          Your wallets hold{" "}
          <span className="num font-semibold text-text">
            {formatUsd(check.totalUsd)}
          </span>
          {check.holdings.some((h) => h.valueUsd === null) ? " or more" : ""}.
          Once your account is deleted, no one can sign for that money again, so
          send it to another wallet first.
        </p>
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {check.holdings.map((h) => (
            <li
              key={h.assetId}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0">
                <span className="num block font-bold text-text">
                  {formatQty(h.available, 6)} {h.symbol}
                </span>
                <span className="block text-sm">
                  {h.valueUsd === null
                    ? "Value unknown"
                    : formatUsd(h.valueUsd)}{" "}
                  · {networkLabel(h.chain)}
                </span>
              </span>
              <Link
                href={`/withdraw?asset=${encodeURIComponent(h.assetId)}`}
                className="shrink-0 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text hover:border-text-muted/40"
              >
                Withdraw
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm">
          Some amounts are below what True Markets will send (for example $5 of
          SOL). Sell those for USDC on the{" "}
          <Link
            href="/invest"
            className="font-semibold text-primary hover:underline dark:text-hero"
          >
            Invest
          </Link>{" "}
          tab first, then withdraw the USDC. Under $1 in total can be left
          behind.
        </p>
      </Card>
    );
  }

  if (!recent) {
    return (
      <Card tone="neutral" title="Sign in again to continue">
        <p>
          For your safety, deleting your account needs a sign-in from the last
          15 minutes. It stops anyone using a phone you left signed in.
        </p>
        <form action={signInAgainAction}>
          <button
            type="submit"
            className="mt-5 rounded-xl bg-primary px-[22px] py-[13px] font-semibold text-white hover:bg-primary-hover"
          >
            Sign in again
          </button>
        </form>
      </Card>
    );
  }

  return (
    <DeleteForm
      email={email}
      leftoverUsd={
        check.leftoverUsd === "0" ? null : formatUsd(check.leftoverUsd)
      }
    />
  );
}

function Card({
  tone,
  title,
  children,
}: {
  tone: "blocked" | "neutral";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[24px] border p-6 sm:p-8 ${tone === "blocked" ? "border-warning/40 bg-warning-bg" : "border-border bg-surface-raised"}`}
    >
      <h2 className="display text-2xl text-text">{title}</h2>
      <div className="mt-3 leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}
