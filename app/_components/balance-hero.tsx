"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon, PadlockMotif } from "./icons";

export interface BalanceHeroProps {
  total: string;
  accessible: string;
  locked: string;
  /** Locked share of the total, 0..100, for the split bar width only. */
  lockedPercent: number;
  practice: boolean;
}

const HIDDEN = "••••••";

/** The one loud card on Home: total savings, and how much of it is locked. */
export function BalanceHero({ total, accessible, locked, lockedPercent, practice }: BalanceHeroProps) {
  const [hidden, setHidden] = useState(false);
  const show = (v: string) => (hidden ? HIDDEN : v);

  return (
    <section
      aria-labelledby="balance-label"
      className="relative overflow-hidden rounded-[24px] bg-hero p-5 shadow-[0_18px_40px_-20px_rgba(0,137,255,0.65)] sm:p-8"
    >
      <PadlockMotif className="pointer-events-none absolute -right-10 -bottom-14 size-64 text-white/15 sm:size-80" />

      <div className="relative flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-frame/90 px-3 py-1 text-xs font-semibold text-white">
          <LockIcon className="size-3.5" />
          {lockedPercent > 0 ? `${Math.round(lockedPercent)}% saved or budgeted` : "Nothing put away yet"}
        </span>
        {practice ? (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-frame">Practice money</span>
        ) : null}
      </div>

      <div className="relative mt-5 flex items-center gap-3">
        <h2 id="balance-label" className="text-sm font-semibold text-frame">
          Total balance
        </h2>
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          aria-pressed={hidden}
          aria-label={hidden ? "Show balances" : "Hide balances"}
          className="-m-2 rounded-full p-2.5 text-frame hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
        >
          {hidden ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      <p className="num display relative mt-1 text-[calc(40px*var(--fs))] leading-none text-white sm:text-[52px]">{show(total)}</p>

      <div className="relative mt-7">
        <div
          className="flex h-3 overflow-hidden rounded-full bg-white"
          role="img"
          aria-label={`${Math.round(lockedPercent)}% saved or budgeted, ${Math.round(100 - lockedPercent)}% free to spend`}
        >
          <div className="h-full bg-locked" style={{ width: `${lockedPercent}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-frame">
              <span className="size-2.5 rounded-full bg-locked" aria-hidden /> Saved &amp; budgeted
            </dt>
            <dd className="num mt-0.5 text-lg font-bold text-frame">{show(locked)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-frame">
              <span className="size-2.5 rounded-full bg-white" aria-hidden /> Free to spend
            </dt>
            <dd className="num mt-0.5 text-lg font-bold text-frame">{show(accessible)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
