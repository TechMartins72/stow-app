import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StowMark } from "@/app/_components/icons";
import { readSession } from "@/app/_server/session";
import { verifyLinkAction } from "@/app/signin/actions";
import { SignInButton } from "./submit-button";
import { LoadingBlock } from "@/app/_components/spinner";

export const metadata: Metadata = { title: "Sign in · Stow", robots: { index: false } };

/**
 * Where emailed links land. Signing in takes a click (a POST), so mail
 * scanners that open links can't use up the one-time token.
 */
export default function VerifyPage({ searchParams }: PageProps<"/auth/verify">) {
  return (
    <div className="grid min-h-dvh place-items-center bg-frame px-4 py-10">
      <div className="w-full max-w-sm rounded-[24px] bg-surface-raised p-6 text-text sm:p-8">
        <div className="flex items-center gap-2.5">
          <StowMark className="size-9" />
          <span className="wordmark text-[calc(17px*var(--fs))]">Stow</span>
        </div>
        <Suspense fallback={<LoadingBlock label="Checking your sign-in link" className="mt-6 h-32 rounded-xl" />}>
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
    // A used link on a browser that's already signed in isn't a problem: say so.
    await connection();
    const session = await readSession();
    if (session) {
      return (
        <div role="status" className="mt-6">
          <h1 className="display text-2xl">You&apos;re already signed in</h1>
          <p className="mt-2 text-text-muted">This link was already used, but this browser is signed in, so there&apos;s nothing else to do.</p>
          <Link href="/" className="mt-6 block rounded-xl bg-primary px-[22px] py-[15px] text-center font-semibold text-white hover:bg-primary-hover">
            Go to my savings &amp; budgets
          </Link>
        </div>
      );
    }
    return (
      <div role="alert" className="mt-6">
        <h1 className="display text-2xl">This link can&apos;t be used</h1>
        <p className="mt-2 text-text-muted">
          Sign-in links work once and only for 15 minutes, so this one was already used or has expired. If you asked for several, use
          the newest email.
        </p>
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
      <SignInButton />
    </form>
  );
}
