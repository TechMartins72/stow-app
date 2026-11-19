"use client";

import { useActionState, useState } from "react";
import { Busy } from "@/app/_components/spinner";
import { TrashIcon } from "@/app/_components/icons";
import { confirmsEmail } from "@/app/_lib/account-deletion";
import { deleteAccountAction, type DeleteState } from "./actions";

// What this browser keeps for Stow (see ask-widget.tsx and advisor-view.tsx). Cleared
// as the form is sent: on success the server redirects away, so there's no "after".
// If deletion is refused, only a saved chat and dismissed suggestions are lost.
const BROWSER_KEYS = { session: ["stow-ask"], local: ["pv:advisor:dismissed"] };

function forgetThisBrowser() {
  try {
    BROWSER_KEYS.session.forEach((k) => sessionStorage.removeItem(k));
    BROWSER_KEYS.local.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage may be blocked; nothing of value is lost.
  }
}

export function DeleteForm({
  email,
  leftoverUsd,
}: {
  email: string;
  leftoverUsd: string | null;
}) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    deleteAccountAction,
    { status: "idle" },
  );
  const [typed, setTyped] = useState("");
  const [leftover, setLeftover] = useState(false);
  const ready = confirmsEmail(typed, email) && (!leftoverUsd || leftover);

  return (
    <section className="rounded-[24px] border border-critical/30 bg-surface-raised p-6 sm:p-8">
      <h2 className="display text-2xl">This can&apos;t be undone</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-bold">We delete</p>
          <ul className="mt-2 space-y-1.5 text-sm text-text-muted">
            <li>Your account and email address</li>
            <li>Your savings goals and budgets</li>
            <li>Your Activity history</li>
            <li>Every sign-in, on every device</li>
            <li>Your saved chat, in this browser</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold">What stays</p>
          <ul className="mt-2 space-y-1.5 text-sm text-text-muted">
            <li>
              True Markets&apos; own records of your wallets and transactions
            </li>
            <li>Anything already recorded on public blockchains</li>
          </ul>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-surface px-3 py-2 text-sm text-text-muted">
        If you sign up again with this email, you&apos;ll start a new account
        with new, empty wallets.
      </p>

      <form
        action={action}
        onSubmit={forgetThisBrowser}
        className="mt-6 space-y-4"
      >
        {leftoverUsd ? (
          <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <input
              type="checkbox"
              name="leftover"
              value="yes"
              checked={leftover}
              onChange={(e) => setLeftover(e.target.checked)}
              className="mt-0.5 size-4 accent-critical"
            />
            <span>
              I understand the{" "}
              <span className="num font-semibold">{leftoverUsd}</span> left in
              my wallets will be lost.
            </span>
          </label>
        ) : null}

        <div>
          <label
            htmlFor="confirm-email"
            className="block text-sm font-semibold"
          >
            Type <span className="font-bold break-all">{email}</span> to confirm
          </label>
          <input
            id="confirm-email"
            name="email"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            aria-describedby="delete-error"
            className="mt-2 w-full rounded-xl border border-border bg-surface-raised px-4 py-3.5 text-base focus:outline-2 focus:outline-critical"
          />
        </div>

        <p
          id="delete-error"
          aria-live="polite"
          className="min-h-5 text-sm font-semibold text-critical"
        >
          {state.status === "error" ? state.message : ""}
        </p>

        <button
          type="submit"
          disabled={!ready || pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-critical px-[22px] py-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <Busy>Deleting…</Busy>
          ) : (
            <>
              <TrashIcon className="size-5" /> Delete my account
            </>
          )}
        </button>
      </form>
    </section>
  );
}
