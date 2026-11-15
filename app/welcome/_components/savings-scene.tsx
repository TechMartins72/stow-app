"use client";

import { useRef } from "react";
import { LockIcon } from "@/app/_components/icons";
import { countTo, sceneTimeline, usd, useMotion } from "./motion";
import { Phone, Ring, RING_CIRCUMFERENCE, StatusBar } from "./phone";

const STEPS = [
  { title: "Name it, choose an amount", body: "Rent, a trip, an emergency fund. In dollars, crypto or stocks." },
  { title: "Pick the date", body: "A month from now, a year, or any day you choose." },
  { title: "It stays put", body: "Until that day Stow refuses to send, sell or trade it, even if you ask. Then it's yours again." },
];

const GOAL = "Rent, December";

/** A savings goal from start to finish, on a loop while it's on screen. */
/** `intro` is the section heading, shown above the steps, beside the phone. */
export function SavingsScene({ intro }: { intro?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (el) => {
    const tl = sceneTimeline(el);
    const name = el.querySelector(".js-name");
    const typed = { n: 0 };

    // Start: the form showing, the goal not made yet.
    tl.set(".js-form", { autoAlpha: 1, x: 0 })
      .set(".js-detail", { autoAlpha: 0 })
      .set(".js-step", { opacity: 0.35 })
      .set(".js-pick", { scale: 0 })
      .set(".js-unlocked", { autoAlpha: 0 })
      .set(".js-days", { autoAlpha: 1 })
      .set(".js-refuse", { autoAlpha: 0, y: 30 })
      .set(".js-bigring", { attr: { stroke: "var(--accent-locked)" } })
      .to(".js-step-0", { opacity: 1, duration: 0.3 })
      .fromTo(
        typed,
        { n: 0 },
        {
          n: GOAL.length,
          duration: 1.1,
          ease: "none",
          onUpdate: () => {
            if (name) name.textContent = GOAL.slice(0, Math.round(typed.n)) || " ";
          },
        },
      );
    countTo(tl, el.querySelector(".js-amount"), { to: 500 }, usd, { duration: 0.8 });
    tl.to(".js-step-1", { opacity: 1, duration: 0.3 }, "+=0.2")
      .to(".js-pick", { scale: 1, duration: 0.35, ease: "back.out(2)" })
      .fromTo(".js-date", { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.3 })
      .to(".js-lockbtn", { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, "+=0.4")
      // Locked: the goal's own page.
      .to(".js-form", { autoAlpha: 0, x: -30, duration: 0.4 }, "+=0.1")
      .fromTo(".js-detail", { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.45 }, "<0.1")
      .to(".js-step-2", { opacity: 1, duration: 0.3 }, "<")
      .fromTo(".js-bigring", { strokeDashoffset: RING_CIRCUMFERENCE }, { strokeDashoffset: RING_CIRCUMFERENCE * 0.38, duration: 1.2 })
      // Someone tries to take it early.
      .to(".js-withdraw", { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, "+=0.5")
      .to(".js-refuse", { autoAlpha: 1, y: 0, duration: 0.4, ease: "back.out(1.6)" })
      .fromTo(".js-padlock", { rotate: 0 }, { keyframes: { rotate: [0, -14, 12, -8, 5, 0] }, duration: 0.6, ease: "none" }, "<0.2")
      // The date arrives: it frees itself.
      .to(".js-refuse", { autoAlpha: 0, y: 20, duration: 0.35 }, "+=1.6")
      .set(".js-bigring", { attr: { stroke: "var(--positive)" } })
      .to(".js-bigring", { strokeDashoffset: 0, duration: 1, ease: "power1.inOut" })
      .to(".js-days", { autoAlpha: 0, duration: 0.2 }, "<")
      .to(".js-unlocked", { autoAlpha: 1, duration: 0.35 }, "-=0.3")
      .to({}, { duration: 1.6 });
  });

  return (
    <div ref={ref} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
      <div>
        {intro}
        <ol className="mt-10 space-y-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`js-step js-step-${i} flex gap-4`}>
              <span className="num grid size-9 shrink-0 place-items-center rounded-full bg-locked text-sm font-bold text-white">{i + 1}</span>
              <span>
                <span className="block text-lg font-bold">{s.title}</span>
                <span className="mt-0.5 block text-text-muted">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <Phone label="Making a savings goal of $500 until December 15. A withdrawal before then is refused; on the date it unlocks.">
        <StatusBar />
        <div className="absolute inset-x-0 top-9 bottom-0">
          {/* 1. The form (hidden in the still frame: the goal is already made). */}
          <div className="js-form invisible absolute inset-0 space-y-4 px-5 pt-5 opacity-0">
            <p className="text-[11px] font-bold tracking-wide text-locked uppercase dark:text-frame-muted">New savings goal</p>
            <Field label="What's it for?">
              <span className="js-name">{GOAL}</span>
              <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-text align-middle" />
            </Field>
            <Field label="How much?">
              <span className="js-amount num display text-2xl">$500.00</span>
              <span className="mt-0.5 block text-[11px] text-text-muted">USDC · $980.00 free</span>
            </Field>
            <div>
              <p className="mb-2 text-[12px] font-semibold">Until when?</p>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
                {["1 month", "3 months", "1 year"].map((d, i) => (
                  <span key={d} className="relative grid place-items-center rounded-xl border border-border bg-surface-raised py-2">
                    {i === 0 ? <span className="js-pick absolute inset-0 rounded-xl border-2 border-primary bg-primary/10" /> : null}
                    <span className="relative">{d}</span>
                  </span>
                ))}
              </div>
              <p className="js-date num mt-2 text-[12px] text-text-muted">Unlocks Tue, 15 Dec 2026</p>
            </div>
            <span className="js-lockbtn flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white">
              <LockIcon className="size-4" /> Lock $500
            </span>
          </div>

          {/* 2. The goal's page. */}
          <div className="js-detail absolute inset-0 px-5 pt-5">
            <p className="text-[11px] font-bold tracking-wide text-locked uppercase dark:text-frame-muted">Savings goal</p>
            <p className="display text-xl">{GOAL}</p>
            <div className="relative mx-auto mt-6 grid size-44 place-items-center">
              <Ring value={0.62} className="absolute inset-0 size-44" ringClass="js-bigring" />
              <div className="text-center">
                <span className="js-padlock mx-auto grid size-9 place-items-center rounded-full bg-locked text-white">
                  <LockIcon className="size-4" />
                </span>
                <p className="num display mt-1 text-2xl">$500.00</p>
                <p className="js-days num text-[11px] font-semibold text-text-muted">31 days left</p>
                <p className="js-unlocked invisible absolute inset-x-0 -bottom-7 text-[12px] font-bold text-positive opacity-0">✓ Unlocked · free to spend</p>
              </div>
            </div>
            <div className="num mt-10 flex justify-between border-t border-border pt-3 text-[12px]">
              <span className="text-text-muted">Goal date</span>
              <span className="font-semibold">Tue, 15 Dec 2026</span>
            </div>
            <span className="js-withdraw mt-4 flex items-center justify-center rounded-xl border border-border bg-surface-raised py-3 text-sm font-semibold">
              Withdraw $500
            </span>
          </div>

          {/* The refusal, as the app shows it. */}
          <div className="js-refuse absolute inset-x-3 bottom-3 rounded-2xl border border-critical/30 bg-critical-bg p-3.5 text-[12px] shadow-lg">
            <p className="font-bold text-critical">Not signed. Nothing moved.</p>
            <p className="mt-0.5 text-text">$500 USDC is locked until 15 Dec, for “{GOAL}”.</p>
          </div>
        </div>
      </Phone>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold">{label}</p>
      <div className="rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm">{children}</div>
    </div>
  );
}
