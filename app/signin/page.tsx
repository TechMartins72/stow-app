import type { Metadata } from "next";
import { PadlockMotif, VaultMark } from "@/app/_components/icons";
import { SignInForm } from "./signin-form";

export const metadata: Metadata = { title: "Sign in · Portfolio Vault" };

export default function SignInPage() {
  const practice = process.env.GATEWAY_MODE !== "live";
  return (
    <div className="min-h-dvh bg-frame text-frame-text lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Story */}
      <section className="relative flex flex-col overflow-hidden px-6 pt-6 pb-10 sm:px-10 lg:py-10">
        <div className="flex items-center gap-2.5">
          <VaultMark className="size-9" />
          <span className="display text-lg">Portfolio Vault</span>
        </div>
        <div className="relative mt-10 overflow-hidden rounded-[24px] bg-hero p-7 sm:p-10 lg:mt-auto">
          <PadlockMotif className="pointer-events-none absolute -right-12 -bottom-16 size-72 text-white/15" />
          <h1 className="display relative max-w-md text-[40px] leading-[1.05] text-white sm:text-[52px]">Your money, locked.</h1>
          <p className="relative mt-4 max-w-sm text-[15px] font-medium text-frame">
            Lock dollars, crypto and stocks until a date you choose, or release them a little each month. Until then, the app
            refuses to move them, even if you ask.
          </p>
        </div>
        <ul className="mt-8 grid gap-3 text-sm text-frame-muted sm:grid-cols-3 lg:mb-auto">
          <li>
            <span className="block font-bold text-frame-text">Locks that hold</span>
            Nothing leaves before its date.
          </li>
          <li>
            <span className="block font-bold text-frame-text">Budget releases</span>
            25% a month, like a salary to yourself.
          </li>
          <li>
            <span className="block font-bold text-frame-text">Real assets</span>
            USDC, SOL and tokenized stocks.
          </li>
        </ul>
      </section>

      {/* Form */}
      <main className="flex items-center justify-center bg-surface px-4 py-10 text-text sm:px-6 lg:rounded-l-[32px]">
        <div className="w-full max-w-sm rounded-[24px] bg-surface-raised p-6 shadow-[0_24px_60px_-30px_rgba(6,15,33,0.35)] sm:p-8">
          <SignInForm practice={practice} />
        </div>
      </main>
    </div>
  );
}
