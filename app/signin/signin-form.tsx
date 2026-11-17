"use client";

import { useActionState, useState } from "react";
import { demoSignInAction, requestLinkAction, type LinkState } from "./actions";
import { Busy } from "@/app/_components/spinner";

export function SignInForm({
  practice,
  google,
  email,
}: {
  practice: boolean;
  google: boolean;
  email: boolean;
}) {
  const [state, sendLink, sending] = useActionState<LinkState, FormData>(
    requestLinkAction,
    { status: "idle" },
  );
  const [editing, setEditing] = useState(false);

  if (state.status === "sent" && !editing) {
    return (
      <div role="status">
        <span
          className="grid size-12 place-items-center rounded-full bg-hero/15 text-2xl"
          aria-hidden
        >
          ✉️
        </span>
        <h2 className="display mt-4 text-2xl">Check your email</h2>
        <p className="mt-2 text-text-muted">
          We sent a sign-in link to{" "}
          <span className="font-semibold text-text">{state.email}</span>. It
          works once and expires in 15 minutes.
        </p>
        {practice ? (
          <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-sm text-text-muted">
            Practice mode: the link is also printed in the server terminal.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-5 text-sm font-semibold text-primary hover:underline"
        >
          Use a different email, or send again
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="display text-2xl">Sign in or create an account</h2>
      <p className="mt-1 text-sm text-text-muted">
        No password.{" "}
        {google && email
          ? "Use your Google account, or we'll email you a link."
          : google
            ? "Use your Google account."
            : "We'll email you a link."}
      </p>

      {google ? (
        <>
          {/* A plain link, not <Link>: it leaves the app for Google, and must never be prefetched. */}
          <a
            href="/auth/google"
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-[22px] py-[14px] font-semibold text-[#1f1f1f] hover:bg-[#f7f8f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <GoogleG className="size-5" /> Continue with Google
          </a>
          {email ? (
            <div className="mt-6 flex items-center gap-3 text-xs font-semibold text-text-muted">
              <span className="h-px flex-1 bg-border" /> or use email{" "}
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : null}
        </>
      ) : null}

      {/* A plain form action keeps this working before JavaScript loads. */}
      {email ? (
        <form
          action={sendLink}
          onSubmit={() => setEditing(false)}
          className={google ? "mt-4" : "mt-6"}
          noValidate
        >
          <label htmlFor="email" className="block text-sm font-semibold">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={state.status === "sent" ? state.email : undefined}
            placeholder="you@example.com"
            aria-invalid={state.status === "error"}
            aria-describedby="email-error"
            className="mt-2 w-full rounded-xl border border-border bg-surface-raised px-4 py-3.5 text-base focus:outline-2 focus:outline-primary"
          />
          <p
            id="email-error"
            aria-live="polite"
            className="mt-2 min-h-5 text-sm text-critical"
          >
            {state.status === "error" ? state.message : ""}
          </p>
          <button
            type="submit"
            disabled={sending}
            className="mt-2 w-full rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {sending ? <Busy>Sending…</Busy> : "Email me a sign-in link"}
          </button>
        </form>
      ) : null}

      {practice ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs font-semibold text-text-muted">
            <span className="h-px flex-1 bg-border" /> or{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={demoSignInAction}>
            <button
              type="submit"
              className="w-full rounded-xl border border-border bg-surface-raised px-[22px] py-[15px] font-semibold hover:border-text-muted/40"
            >
              Try it with practice money
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-text-muted">
            A fresh demo account with fake funds. Nothing real moves.
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Google's "G", as its sign-in branding guidelines ask for. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
