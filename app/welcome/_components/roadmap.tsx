"use client";

import { useRef } from "react";
import { gsap, useMotion } from "./motion";

// Where Stow is going: Now (live), Next, Later. No dates on purpose: a missed date
// reads worse than none. Items say what they do for a saver, not how they're built.

type Stage = {
  id: "now" | "next" | "later";
  label: string;
  tag: string;
  items: string[];
};

const STAGES: Stage[] = [
  {
    id: "now",
    label: "Now",
    tag: "Live",
    items: [
      "Savings goals",
      "Budgets that pay you back",
      "Buy and lock stocks and crypto",
      "Ask Stow",
      "Refuses to break your locks",
    ],
  },
  {
    id: "next",
    label: "Next",
    tag: "In the works",
    items: [
      "Reminders when money frees up",
      "Save automatically: “$20 every Friday”",
      "Spending limits you set yourself",
      "Trusted addresses for sending",
    ],
  },
  {
    id: "later",
    label: "Later",
    tag: "On the horizon",
    items: [
      "iPhone and Android apps",
      "Bank deposits and withdrawals",
      "Save together with family or a partner",
      "More stocks and coins",
    ],
  },
];

const STYLE = {
  now: {
    dot: "bg-positive text-white",
    line: "border-positive",
    tag: "bg-positive/15 text-positive",
    card: "border border-border bg-surface-raised shadow-[0_24px_60px_-30px_rgba(6,15,33,0.35)]",
    item: "text-text",
  },
  next: {
    dot: "border-2 border-hero bg-surface-raised",
    line: "border-dashed border-hero/60",
    tag: "bg-hero/15 text-primary dark:text-hero",
    card: "border-2 border-hero/30 bg-surface-raised",
    item: "text-text",
  },
  later: {
    dot: "border-2 border-dashed border-text-muted/50 bg-surface",
    line: "border-dashed border-text-muted/30",
    tag: "bg-text-muted/10 text-text-muted",
    card: "border border-dashed border-text-muted/40",
    item: "text-text-muted",
  },
} as const;

/** Three stages on a track: across on wider screens, down the left on phones. */
export function Roadmap() {
  const ref = useRef<HTMLOListElement>(null);
  useMotion(ref, (el) => {
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: el, start: "top 75%", once: true },
    });
    // The "Now" segment of the track fills in, then each stage rises in turn.
    tl.from(el.querySelector(".js-fill"), {
      [wide ? "scaleX" : "scaleY"]: 0,
      duration: 0.9,
      ease: "power2.inOut",
    });
    tl.from(
      el.querySelectorAll(".js-stage"),
      { y: 24, autoAlpha: 0, stagger: 0.18, duration: 0.7, ease: "power3.out" },
      0.2,
    );
    // A soft pulse on the "Now" dot, a few times, then still.
    gsap.fromTo(
      el.querySelector(".js-pulse"),
      { scale: 1, autoAlpha: 0.6 },
      {
        scale: 2.2,
        autoAlpha: 0,
        duration: 1.6,
        ease: "power1.out",
        repeat: 3,
        delay: 1,
        scrollTrigger: { trigger: el, start: "top 75%", once: true },
      },
    );
  });

  return (
    <ol
      ref={ref}
      className="grid grid-cols-1 gap-y-10 md:grid-cols-3 md:gap-x-6"
    >
      {STAGES.map((s, i) => {
        const st = STYLE[s.id];
        const last = i === STAGES.length - 1;
        return (
          <li key={s.id} className="relative pl-11 md:pt-12 md:pl-0">
            {/* Track segment: down the left on phones, across the top from md. It runs into the next stage's gap. */}
            <span
              aria-hidden
              className={`absolute top-7 -bottom-10 left-[13px] border-l-2 md:top-[13px] md:right-[-1.5rem] md:bottom-auto md:left-7 md:border-t-2 md:border-l-0 ${st.line} ${
                last
                  ? "[mask-image:linear-gradient(180deg,#000,transparent)] md:[mask-image:linear-gradient(90deg,#000,transparent)]"
                  : ""
              } ${s.id === "now" ? "js-fill origin-top md:origin-left" : ""}`}
            />
            {/* Stage dot */}
            <span
              aria-hidden
              className={`absolute top-0 left-0 grid size-7 place-items-center rounded-full ${st.dot}`}
            >
              {s.id === "now" ? (
                <>
                  <span className="js-pulse absolute inset-0 rounded-full bg-positive opacity-0" />
                  <span className="relative text-xs font-bold">✓</span>
                </>
              ) : null}
            </span>

            <div className="js-stage">
              <h3 className="flex flex-wrap items-center gap-2 md:-mt-1">
                <span className="display text-xl">{s.label}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.tag}`}
                >
                  {s.tag}
                </span>
              </h3>
              <ul className={`mt-4 space-y-3 rounded-[20px] p-5 ${st.card}`}>
                {s.items.map((item) => (
                  <li key={item} className={`flex gap-2.5 ${st.item}`}>
                    {s.id === "now" ? (
                      <span
                        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-positive text-[11px] font-bold text-white"
                        aria-hidden
                      >
                        ✓
                      </span>
                    ) : (
                      <span
                        className={`mt-[7px] size-2 shrink-0 rounded-full ${s.id === "next" ? "bg-hero" : "border border-text-muted/60"}`}
                        aria-hidden
                      />
                    )}
                    <span className="font-semibold">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
