import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { VaultMark } from "@/app/_components/icons";
import { verifyLinkAction } from "@/app/signin/actions";

export const metadata: Metadata = { title: "Sign in · Portfolio Vault", robots: { index: false } };

/**
 * Where emailed links land. Signing in takes a click (a POST), so mail
 * scanners that open links can't use up the one-time token.
 */
export default function VerifyPage({ searchParams }: PageProps<"/auth/verify">) {
  return (
    <div className="grid min-h-dvh place-items-center bg-frame px-4 py-10">
      <div className="w-full max-w-sm rounded-[24px] bg-surface-raised p-6 text-text sm:p-8">
        <div className="flex items-center gap-2.5">
          <VaultMark className="size-9" />
          <span className="display text-lg">Portfolio Vault</span>
        </div>
        <Suspense fallback={<div className="mt-6 h-32 animate-pulse rounded-xl bg-border/60" />}>
          <VerifyBody searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function VerifyBody({ searchParams }: Pick<PageProps<"/auth/verify">, "searchParams">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (params.error || !token) {
    return (
      <div role="alert" className="mt-6">
        <h1 className="display text-2xl">This link has expired</h1>
        <p className="mt-2 text-text-muted">Sign-in links work once and only for 15 minutes. Ask for a new one.</p>
        <Link href="/signin" className="mt-6 block rounded-xl bg-primary px-[22px] py-[15px] text-center font-semibold text-white hover:bg-primary-hover">
          Get a new link
        </Link>
      </div>
    );
  }

  return (
    <form action={verifyLinkAction} className="mt-6">
      <h1 className="display text-2xl">Welcome back</h1>
      <p className="mt-2 text-text-muted">Tap below to finish signing in on this device.</p>
      <input type="hidden" name="token" value={token} />
      <button type="submit" className="mt-6 w-full rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white hover:bg-primary-hover">
        Sign in to Portfolio Vault
      </button>
    </form>
  );
}
