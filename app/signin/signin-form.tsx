"use client";

import { useActionState, useState } from "react";
import { demoSignInAction, requestLinkAction, type LinkState } from "./actions";
import { Busy } from "@/app/_components/spinner";

export function SignInForm({ practice }: { practice: boolean }) {
  const [state, sendLink, sending] = useActionState<LinkState, FormData>(requestLinkAction, { status: "idle" });
  const [editing, setEditing] = useState(false);

  if (state.status === "sent" && !editing) {
    return (
      <div role="status">
        <span className="grid size-12 place-items-center rounded-full bg-hero/15 text-2xl" aria-hidden>
          ✉️
        </span>
        <h2 className="display mt-4 text-2xl">Check your email</h2>
        <p className="mt-2 text-text-muted">
          We sent a sign-in link to <span className="font-semibold text-text">{state.email}</span>. It works once and expires in 15
          minutes.
        </p>
        {practice ? (
          <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-sm text-text-muted">
            Practice mode: the link is also printed in the server terminal.
          </p>
        ) : null}
        <button type="button" onClick={() => setEditing(true)} className="mt-5 text-sm font-semibold text-primary hover:underline">
          Use a different email, or send again
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="display text-2xl">Sign in or create an account</h2>
      <p className="mt-1 text-sm text-text-muted">No password. We&apos;ll email you a link.</p>

      {/* A plain form action keeps this working before JavaScript loads. */}
      <form action={sendLink} onSubmit={() => setEditing(false)} className="mt-6" noValidate>
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
        <p id="email-error" aria-live="polite" className="mt-2 min-h-5 text-sm text-critical">
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

      {practice ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs font-semibold text-text-muted">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <form action={demoSignInAction}>
            <button
              type="submit"
              className="w-full rounded-xl border border-border bg-surface-raised px-[22px] py-[15px] font-semibold hover:border-text-muted/40"
            >
              Try it with practice money
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-text-muted">A fresh demo account with fake funds. Nothing real moves.</p>
        </>
      ) : null}
    </div>
  );
}
