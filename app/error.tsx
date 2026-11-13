"use client";

// Shown when a page can't load: the device is offline, or the server can't reach
// the database or True Markets. Says which, in plain words, and recovers by itself
// when the connection comes back. Technical details stay under "Details".

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useOnline } from "./_components/connection-banner";
import { PadlockMotif, StowMark } from "./_components/icons";
import { Busy } from "./_components/spinner";

export default function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  const online = useOnline();
  const wasOffline = useRef(!online);
  const digest = error instanceof Error && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Back online after being offline: try again without waiting for a tap.
  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) {
      wasOffline.current = false;
      retry();
    }
  }, [online, retry]);

  const title = online ? "We can't reach your account right now" : "You're offline";
  const body = online
    ? "Our connection to your wallet or account data is having trouble. Your money is safe: nothing moves without the app signing it, and nothing was signed. This usually clears up within a minute."
    : "Check your Wi-Fi or mobile data. We'll reload this page as soon as you're back online. Your money is safe: nothing moves while you're offline.";

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <StowMark className="size-8" />
          <span className="wordmark text-[calc(17px*var(--fs))]">Stow</span>
        </div>
        <section role="alert" className="relative overflow-hidden rounded-[24px] border border-border bg-surface-raised p-6 sm:p-8">
          <PadlockMotif className="pointer-events-none absolute -right-10 -bottom-12 size-48 text-locked/10" />
          <span
            className={`relative grid size-12 place-items-center rounded-full text-xl font-bold ${online ? "bg-warning-bg text-warning" : "bg-border text-text-muted"}`}
            aria-hidden
          >
            {online ? "!" : "⌁"}
          </span>
          <h1 className="display relative mt-4 text-2xl">{title}</h1>
          <p className="relative mt-2 text-sm text-text-muted">{body}</p>
          <div className="relative mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => retry()}
              disabled={!online}
              className="rounded-xl bg-primary px-[22px] py-[13px] text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {online ? "Try again" : <Busy>Waiting for connection…</Busy>}
            </button>
            <Link href="/learn" className="rounded-xl border border-border px-[22px] py-[13px] text-sm font-semibold hover:border-text-muted/40">
              How the app keeps money safe
            </Link>
          </div>
          {digest ? (
            <details className="relative mt-5 text-xs text-text-muted">
              <summary className="cursor-pointer font-semibold">Details</summary>
              <p className="mt-1">
                Error reference: <code className="num">{digest}</code>
              </p>
            </details>
          ) : null}
        </section>
      </div>
    </main>
  );
}
