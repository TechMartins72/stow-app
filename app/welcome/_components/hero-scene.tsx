"use client";

import { useRef } from "react";
import { ArrowRightIcon, LockIcon, PieIcon, PlusIcon } from "@/app/_components/icons";
import { countTo, gsap, usd, useMotion } from "./motion";
import { Phone, Ring, StatusBar } from "./phone";

/** Home, as the app shows it: balance, what's free and put away, and the vault. */
export function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (el) => {
    const intro = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.2 });
    intro
      .from(".js-phone", { y: 60, autoAlpha: 0, duration: 1 })
      .from(".js-row", { y: 16, autoAlpha: 0, stagger: 0.08, duration: 0.6 }, "-=0.5")
      .from(".js-ring", { strokeDashoffset: 138, duration: 1.2, ease: "power2.out" }, "-=0.4")
      .from(".js-chip", { scale: 0.6, autoAlpha: 0, stagger: 0.12, duration: 0.5, ease: "back.out(2)" }, "-=1");
    countTo(intro, el.querySelector(".js-total"), { to: 2480 }, usd, { duration: 1.4 }, 0.6);

    // The two floating notes drift gently.
    gsap.to(".js-float", { y: -8, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.8 });
  });

  return (
    <div ref={ref} className="relative">
      <Phone label="The Stow app's Home screen: total balance, money free to spend, money put away, and the vault." className="js-phone">
        <StatusBar />
        <div className="space-y-3 px-4 pt-4">
          <div className="js-row flex items-center justify-between">
            <span className="wordmark text-[13px]">Stow</span>
            <span className="grid size-7 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">A</span>
          </div>

          <div className="js-row relative overflow-hidden rounded-[20px] bg-frame p-4 text-frame-text">
            <p className="text-[11px] font-semibold text-frame-muted">Total balance</p>
            <p className="js-total num display text-[28px] leading-tight">$2,480.00</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-xl bg-white/8 p-2.5">
                <p className="font-semibold text-frame-muted">Free to spend</p>
                <p className="num mt-0.5 text-[15px] font-bold">$980.00</p>
              </div>
              <div className="rounded-xl bg-white/8 p-2.5">
                <p className="font-semibold text-frame-muted">Put away</p>
                <p className="num mt-0.5 text-[15px] font-bold">$1,500.00</p>
              </div>
            </div>
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <span className="w-[40%] bg-hero" />
              <span className="w-[60%] bg-locked" />
            </div>
          </div>

          <div className="js-row grid grid-cols-4 gap-1.5 text-[10px] font-semibold">
            {[
              { l: "Add funds", I: PlusIcon },
              { l: "New plan", I: LockIcon, primary: true },
              { l: "Invest", I: PieIcon },
              { l: "Withdraw", I: ArrowRightIcon },
            ].map(({ l, I, primary }) => (
              <span
                key={l}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${primary ? "bg-primary text-white" : "border border-border bg-surface-raised"}`}
              >
                <I className="size-4" />
                {l}
              </span>
            ))}
          </div>

          <p className="js-row display pt-1 text-[15px]">Your vault</p>
          <MiniLock kind="Savings goal" name="Rent, December" amount="$500.00" foot="31 days left" value={0.62} />
          <MiniLock kind="Budget" name="Monthly allowance" amount="$1,000.00" foot="$500 USDC in 12 days" value={0.5} budget />
        </div>
      </Phone>

      {/* Notes that float beside the phone on wide screens. */}
      <div className="js-chip js-float absolute top-28 -left-4 hidden rounded-2xl border border-border bg-surface-raised px-3.5 py-2.5 text-xs shadow-xl lg:-left-20 lg:block">
        <p className="font-bold text-text">Withdraw $500 refused</p>
        <p className="text-text-muted">Locked until Dec 15</p>
      </div>
      <div className="js-chip js-float absolute right-0 bottom-28 hidden rounded-2xl border border-border bg-surface-raised px-3.5 py-2.5 text-xs shadow-xl lg:-right-16 lg:block">
        <p className="font-bold text-positive">+ $500 paid to you</p>
        <p className="text-text-muted">Budget · part 2 of 4</p>
      </div>
    </div>
  );
}

function MiniLock({ kind, name, amount, foot, value, budget = false }: { kind: string; name: string; amount: string; foot: string; value: number; budget?: boolean }) {
  return (
    <div className="js-row rounded-[18px] border border-border bg-surface-raised p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[9px] font-bold tracking-wide uppercase ${budget ? "text-hero" : "text-locked dark:text-frame-muted"}`}>{kind}</p>
          <p className="truncate text-[13px] font-bold">{name}</p>
          <p className="num display mt-1 text-[17px]">{amount}</p>
        </div>
        <div className="relative">
          <Ring value={value} className="size-11" ringClass="js-ring" stroke={budget ? "var(--hero)" : "var(--accent-locked)"} />
          <span className="num absolute inset-0 grid place-items-center text-[9px] font-bold">{Math.round(value * 100)}%</span>
        </div>
      </div>
      <span className="mt-2 inline-block rounded-full bg-locked/10 px-2 py-0.5 text-[10px] font-bold text-locked dark:bg-locked/30 dark:text-frame-text">{foot}</span>
    </div>
  );
}
