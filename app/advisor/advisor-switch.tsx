"use client";

import { useTransition } from "react";
import { SparkIcon } from "@/app/_components/icons";
import { useToast } from "@/app/_components/toaster";
import { setAdvisorEnabledAction } from "./actions";

/** Turns the Advisor on or off for this user. Off: no suggestions anywhere, and nothing can be approved. */
export function AdvisorSwitch({ enabled }: { enabled: boolean }) {
  const toast = useToast();
  const [saving, start] = useTransition();
  const flip = () =>
    start(async () => {
      await setAdvisorEnabledAction(!enabled);
      toast({
        tone: "success",
        title: enabled ? "Advisor switched off" : "Advisor switched on",
        body: enabled ? "No more suggestions. Your locks and budgets work exactly the same." : undefined,
      });
    });

  return (
    <section className="flex items-center gap-4 rounded-[20px] border border-border bg-surface-raised p-5 sm:p-6">
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${enabled ? "bg-hero/15 text-hero" : "bg-border text-text-muted"}`} aria-hidden>
        <SparkIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="advisor-switch-label" className="font-bold">
          Advisor {enabled ? "on" : "off"}
        </h2>
        <p className="text-sm text-text-muted">
          {enabled ? "Suggests ways to save more and keep your budget on track." : "You won't see suggestions on Home or here."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="advisor-switch-label"
        disabled={saving}
        onClick={flip}
        className={`relative h-8 w-14 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${
          enabled ? "bg-primary" : "bg-border"
        }`}
      >
        <span className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : ""}`} />
      </button>
    </section>
  );
}
