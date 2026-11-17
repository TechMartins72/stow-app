import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { googleConfig } from "@/app/_server/google-auth";
import { readSession } from "@/app/_server/session";
import Link from "next/link";
import {
  ArrowRightIcon,
  PadlockMotif,
  StowMark,
} from "@/app/_components/icons";
import { SignInForm } from "./signin-form";

export const metadata: Metadata = { title: "Sign in · Stow" };

/** A browser that's still signed in (sessions last 30 days) goes straight Home. */
async function SendHomeIfSignedIn() {
  await connection(); // per-request: reads the cookie and the clock
  if (await readSession()) redirect("/");
  return null;
}

export default function SignInPage() {
  const practice = process.env.GATEWAY_MODE !== "live";
  const google = googleConfig() !== null;
  // Live sign-in emails go through Resend's test sender, which only delivers to the
  // account owner, so with Google set up the email link is hidden. Practice mode keeps
  // it (links are printed to the server log), and it's the fallback when Google isn't set up.
  const email = practice || !google;
  return (
    <div className="min-h-dvh bg-frame text-frame-text lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Story */}
      <section className="relative flex flex-col overflow-hidden px-6 pt-6 pb-10 sm:px-10 lg:py-10">
        <Link
          href="/welcome"
          className="flex w-fit items-center gap-2.5"
          aria-label="About Stow"
        >
          <StowMark className="size-9" />
          <span className="wordmark text-[calc(17px*var(--fs))]">Stow</span>
        </Link>
        <div className="relative mt-10 overflow-hidden rounded-[24px] bg-hero p-7 sm:p-10 lg:mt-auto">
          <PadlockMotif className="pointer-events-none absolute -right-12 -bottom-16 size-72 text-white/15" />
          <h1 className="display relative max-w-md text-[calc(40px*var(--fs))] leading-[1.05] text-white sm:text-[52px]">
            Save it. Budget it.
          </h1>
          <p className="relative mt-4 max-w-sm text-[calc(15px*var(--fs))] font-medium text-frame">
            Put money away for a goal, or pay it back to yourself a little each
            month like a salary. Until each date, the app refuses to move it,
            even if you ask.
          </p>
        </div>
        <ul className="mt-8 grid gap-3 text-sm text-frame-muted sm:grid-cols-3">
          <li>
            <span className="block font-bold text-frame-text">
              Savings goals
            </span>
            Nothing leaves before its date.
          </li>
          <li>
            <span className="block font-bold text-frame-text">
              Budgets that pay you
            </span>
            25% a month, like a salary to yourself.
          </li>
          <li>
            <span className="block font-bold text-frame-text">
              Dollars, crypto, stocks
            </span>
            USDC, SOL, Bitcoin and tokenized stocks.
          </li>
        </ul>
        <Link
          href="/learn"
          className="mt-6 inline-flex w-fit items-center gap-1 text-sm font-semibold text-frame-text hover:underline lg:mb-auto"
        >
          How it works <ArrowRightIcon className="size-4" />
        </Link>
      </section>

      {/* Form */}
      <main className="flex items-center justify-center bg-surface px-4 py-10 text-text sm:px-6 lg:rounded-l-[32px]">
        <div className="w-full max-w-sm rounded-[24px] bg-surface-raised p-6 shadow-[0_24px_60px_-30px_rgba(6,15,33,0.35)] sm:p-8">
          <SignInForm practice={practice} google={google} email={email} />
          <Suspense fallback={null}>
            <SendHomeIfSignedIn />
          </Suspense>
          <p className="mt-6 text-center text-xs text-text-muted">
            By continuing you agree to how we handle your data in our{" "}
            <Link
              href="/privacy"
              className="font-semibold underline hover:text-text"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
