"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { PROFILES, type RiskProfile } from "@/app/_lib/advisor";
import type { CheckedSuggestion } from "@/app/_server/advisor";
import { LockIcon, SparkIcon } from "@/app/_components/icons";
import { useToast } from "@/app/_components/toaster";
import { approveSuggestionAction, setProfileAction } from "./actions";

const DISMISSED_KEY = "pv:advisor:dismissed";
const CHANGED = "pv:advisor:dismissed-changed";

// Dismissals are a per-browser convenience kept in localStorage. Read through
// useSyncExternalStore so the server render (nothing dismissed) and the browser agree.
function readRaw(): string {
  try {
    return localStorage.getItem(DISMISSED_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}
function parse(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function AdvisorView({ profile, suggestions }: { profile: RiskProfile; suggestions: CheckedSuggestion[] }) {
  const toast = useToast();
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const [sessionDismissed, setSessionDismissed] = useState<string[]>([]);
  const dismissed = [...parse(raw), ...sessionDismissed];
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [savingProfile, startProfile] = useTransition();
  const [, startApprove] = useTransition();

  function dismiss(id: string) {
    setSessionDismissed((d) => [...d, id]);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...new Set([...parse(readRaw()), id])].slice(-50)));
      window.dispatchEvent(new Event(CHANGED));
    } catch {
      // Storage blocked: the dismissal lasts until the page reloads.
    }
  }

  function approve(s: CheckedSuggestion) {
    setPendingId(s.id);
    startApprove(async () => {
      const r = await approveSuggestionAction(s.id);
      setPendingId(null);
      if (r.ok) toast({ tone: "success", title: "Done", body: r.message, href: r.href, linkLabel: r.linkLabel });
      else toast({ tone: r.blocked ? "info" : "error", title: r.blocked ? "The app didn't sign it" : "Not done", body: r.message });
    });
  }

  const visible = suggestions.filter((s) => !dismissed.includes(s.id));

  return (
    <div className="space-y-8">
      <section aria-labelledby="profile-title" className="rounded-[20px] border border-border bg-surface-raised p-5 sm:p-6">
        <h2 id="profile-title" className="font-bold">
          How much risk is OK for you?
        </h2>
        <div role="radiogroup" aria-label="Risk profile" className="mt-3 grid gap-2 sm:grid-cols-3">
          {PROFILES.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={profile === p.value}
              disabled={savingProfile}
              onClick={() =>
                startProfile(async () => {
                  await setProfileAction(p.value);
                  toast({ tone: "success", title: `Profile set to ${p.label}` });
                })
              }
              className={`rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
                profile === p.value ? "border-primary bg-primary text-white" : "border-border hover:border-text-muted/40"
              }`}
            >
              <span className="block font-bold">{p.label}</span>
              <span className={`mt-0.5 block text-xs ${profile === p.value ? "text-white/85" : "text-text-muted"}`}>{p.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="suggestions-title">
        <h2 id="suggestions-title" className="display mb-3 text-xl">
          Suggestions <span className="num text-text-muted">· {visible.length}</span>
        </h2>
        {visible.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-border bg-surface-raised p-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-positive/15 text-xl text-positive" aria-hidden>
              ✓
            </span>
            <p className="mt-3 font-bold">You&apos;re on track</p>
            <p className="mt-1 text-sm text-text-muted">Nothing to suggest right now. Check back after your balances change.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((s) => (
              <li key={s.id} className="rounded-[20px] border border-border bg-surface-raised p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-hero/15 text-hero" aria-hidden>
                    {s.action.kind === "lock" ? <LockIcon className="size-5" /> : <SparkIcon className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="num font-bold">{s.title}</h3>
                    <p className="mt-1 text-sm text-text-muted">{s.why}</p>
                    <p className="num mt-2 text-sm">{s.impact}</p>
                    {s.check ? (
                      <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.check.allowed ? "bg-positive/15 text-positive" : "bg-critical-bg text-critical"}`}>
                        {s.check.allowed ? "✓ Passes your locks and limits" : `Blocked: ${s.check.reason}`}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 sm:pl-[52px]">
                  {s.action.kind === "link" ? (
                    <Link href={s.action.href} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover">
                      {s.action.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => approve(s)}
                      disabled={pendingId !== null || s.check?.allowed === false}
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingId === s.id ? "Working…" : "Approve"}
                    </button>
                  )}
                  <button type="button" onClick={() => dismiss(s.id)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
