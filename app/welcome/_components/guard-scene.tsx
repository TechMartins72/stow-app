"use client";

import { useRef } from "react";
import { LockIcon, SparkIcon } from "@/app/_components/icons";
import { sceneTimeline, useMotion } from "./motion";

// Two requests through the same check: a small buy from free money is signed;
// sending locked money is not. The still frame shows the refusal.
const CHECKS = ["Is this money free, or locked in a plan?", "Has the price moved more than 1%?", "Is it you, or your Advisor, asking?"];

export function GuardScene() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, () => {
    const tl = sceneTimeline(ref.current!, { repeatDelay: 0.8 });
    const run = (req: "ok" | "no") => {
      const show = req === "ok" ? ".js-ok" : ".js-no";
      const hide = req === "ok" ? ".js-no" : ".js-ok";
      tl.set(hide, { autoAlpha: 0 })
        .set(".js-tick", { autoAlpha: 0, scale: 0.4 })
        .set(".js-flow", { scaleX: 0, scaleY: 0 })
        .set(".js-stage", { borderColor: "var(--border)" })
        .fromTo(`.js-req ${show}`, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4 })
        .to(".js-stage-0", { borderColor: "var(--hero)", duration: 0.3 }, "<")
        .to(".js-flow-0", { scaleX: 1, scaleY: 1, duration: 0.5, ease: "power1.inOut" }, "+=0.3")
        .to(".js-stage-1", { borderColor: "var(--hero)", duration: 0.3 });
      CHECKS.forEach((_, i) => {
        const fails = req === "no" && i === 0;
        tl.to(`.js-check-${i} ${fails ? ".js-tick-no" : ".js-tick-ok"}`, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2.5)" }, "+=0.25");
      });
      tl.to(".js-flow-1", { scaleX: 1, scaleY: 1, duration: 0.5, ease: "power1.inOut" }, "+=0.2")
        .to(".js-stage-2", { borderColor: req === "ok" ? "var(--positive)" : "var(--critical)", duration: 0.3 })
        .fromTo(`.js-out ${show}`, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(1.8)" }, "<")
        .to({}, { duration: 2.2 })
        .to([`.js-req ${show}`, `.js-out ${show}`], { autoAlpha: 0, duration: 0.3 });
    };
    run("ok");
    run("no");
  });

  return (
    <div ref={ref} className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1fr_auto_1.3fr_auto_1fr]">
      <Stage index={0} title="You ask">
        <div className="js-req relative min-h-24">
          <Request className="js-ok invisible opacity-0" title="Buy $20 of SOL" note="From your free USDC" />
          <Request className="js-no absolute inset-0" title="Send $500 USDC" note="From “Rent, December”" />
        </div>
      </Stage>

      <Flow index={0} />

      <Stage index={1} title="Stow checks, before it signs">
        <ul className="space-y-2.5">
          {CHECKS.map((c, i) => (
            <li key={c} className={`js-check-${i} flex items-start gap-2.5 text-sm`}>
              <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border">
                <span className={`js-tick js-tick-ok absolute inset-0 grid place-items-center rounded-full bg-positive text-[11px] font-bold text-white ${i === 0 ? "invisible opacity-0" : ""}`}>✓</span>
                <span className={`js-tick js-tick-no absolute inset-0 grid place-items-center rounded-full bg-critical text-[11px] font-bold text-white ${i === 0 ? "" : "invisible opacity-0"}`}>✕</span>
              </span>
              <span className="text-text-muted">{c}</span>
            </li>
          ))}
        </ul>
      </Stage>

      <Flow index={1} />

      <Stage index={2} title="What happens">
        <div className="js-out relative min-h-24">
          <div className="js-ok invisible absolute inset-0 opacity-0">
            <p className="font-bold text-positive">Signed</p>
            <p className="mt-1 text-sm text-text-muted">Sent to True Markets. You get your SOL in seconds.</p>
          </div>
          <div className="js-no">
            <p className="flex items-center gap-1.5 font-bold text-critical">
              <LockIcon className="size-4" /> Not signed
            </p>
            <p className="mt-1 text-sm text-text-muted">Nothing moves. It&apos;s locked until 15 Dec, and the app tells you which plan stopped it.</p>
          </div>
        </div>
      </Stage>
    </div>
  );
}

function Stage({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <div className={`js-stage js-stage-${index} rounded-[20px] border-2 bg-surface-raised p-5 ${index === 2 ? "border-critical" : index === 0 ? "border-hero" : "border-border"}`}>
      <p className="mb-3 text-xs font-bold tracking-wide text-text-muted uppercase">{title}</p>
      {children}
    </div>
  );
}

function Request({ className, title, note }: { className: string; title: string; note: string }) {
  return (
    <div className={className}>
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-text-muted">{note}</p>
      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-hero/15 px-2 py-0.5 text-xs font-semibold text-hero">
        <SparkIcon className="size-3" /> or your Advisor
      </p>
    </div>
  );
}

/** The connector between stages: across on wide screens, down on phones. */
function Flow({ index }: { index: number }) {
  return (
    <div className="flex items-center justify-center py-1 lg:px-1 lg:py-0" aria-hidden>
      <span className="relative h-6 w-1 overflow-hidden rounded-full bg-border lg:h-1 lg:w-10">
        <span className={`js-flow js-flow-${index} absolute inset-0 origin-top bg-hero lg:origin-left`} />
      </span>
    </div>
  );
}
