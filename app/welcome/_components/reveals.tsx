"use client";

import { useRef } from "react";
import { ArrowRightIcon, LockIcon, PlusIcon } from "@/app/_components/icons";
import { gsap, useMotion } from "./motion";

/** Fades up every `[data-reveal]` inside as it scrolls into view. */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useMotion(ref, (el) => {
    el.querySelectorAll<HTMLElement>("[data-reveal]").forEach((item) => {
      gsap.from(item, {
        y: 28,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power3.out",
        delay: Number(item.dataset.reveal || 0),
        scrollTrigger: { trigger: item, start: "top 88%", once: true },
      });
    });
  });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

const ROWS = [
  { icon: <ArrowRightIcon className="size-4 rotate-135" />, bg: "bg-positive text-white", title: "Received 250 USDC", detail: "From 9xQeWv…VFin · Solana", time: "9:02 AM" },
  { icon: <LockIcon className="size-4" />, bg: "bg-locked text-white", title: "Locked 500 USDC", detail: "Rent, December", time: "9:05 AM" },
  { icon: <PlusIcon className="size-4" />, bg: "bg-hero text-white", title: "Bought 0.12 SOL", detail: "$20.00 of USDC", time: "11:40 AM" },
  { icon: <LockIcon className="size-4" />, bg: "bg-critical-bg text-critical", title: "Send USDC refused", detail: "500 USDC is locked until 15 Dec.", time: "4:18 PM", badge: "Not signed" },
  { icon: <span className="text-sm font-bold">✓</span>, bg: "bg-positive text-white", title: "500 USDC unlocked", detail: "Monthly allowance · part 2 of 4", time: "12:00 AM" },
];

/** The Activity screen filling in: every deposit, trade, lock, refusal and pay-out. */
export function ActivityScene() {
  const ref = useRef<HTMLDivElement>(null);
  useMotion(ref, (el) => {
    gsap.from(el.querySelectorAll(".js-act"), {
      x: -24,
      autoAlpha: 0,
      stagger: 0.18,
      duration: 0.6,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 75%", once: true },
    });
  });
  return (
    <div ref={ref} role="img" aria-label="The Activity screen: a deposit received, a goal locked, a buy, a refused send and a budget pay-out.">
      <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface-raised shadow-[0_24px_60px_-30px_rgba(6,15,33,0.35)]" aria-hidden>
        {ROWS.map((r) => (
          <li key={r.title} className="js-act flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${r.bg}`}>{r.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="num block font-bold">{r.title}</span>
              <span className="block truncate text-sm text-text-muted">{r.detail}</span>
              {r.badge ? <span className="mt-1 inline-block rounded-full bg-critical-bg px-2 py-0.5 text-xs font-semibold text-critical">{r.badge}</span> : null}
            </span>
            <span className="num shrink-0 text-xs text-text-muted">{r.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ASSETS = [
  { t: "USDC", n: "US dollars", c: "bg-hero" },
  { t: "SOL", n: "Solana", c: "bg-stocks" },
  { t: "ETH", n: "Ethereum", c: "bg-primary" },
  { t: "BTC", n: "Bitcoin", c: "bg-warning" },
  { t: "AAPL", n: "Apple", c: "bg-text-muted" },
  { t: "NVDA", n: "NVIDIA", c: "bg-positive" },
  { t: "MSFT", n: "Microsoft", c: "bg-hero" },
  { t: "TSLA", n: "Tesla", c: "bg-critical" },
  { t: "AMZN", n: "Amazon", c: "bg-warning" },
  { t: "GOOGL", n: "Alphabet", c: "bg-primary" },
  { t: "META", n: "Meta", c: "bg-stocks" },
];

/** What you can stow, drifting slowly sideways. Pauses on hover. */
export function AssetStrip() {
  const ref = useRef<HTMLDivElement>(null);
  useMotion(ref, (el) => {
    const tween = gsap.to(el.querySelector(".js-track"), { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
    const pause = () => tween.pause();
    const play = () => tween.play();
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", play);
    return () => {
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", play);
    };
  });
  const chips = (hidden: boolean) =>
    ASSETS.map((a) => (
      <li key={`${a.t}${hidden}`} aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-2.5 rounded-full border border-border bg-surface-raised py-2 pr-4 pl-2">
        <span className={`grid size-8 place-items-center rounded-full text-[10px] font-bold text-white ${a.c}`}>{a.t.slice(0, 4)}</span>
        <span className="text-sm">
          <span className="font-bold">{a.t}</span> <span className="text-text-muted">{a.n}</span>
        </span>
      </li>
    ));
  return (
    <div ref={ref} className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <ul className="js-track flex w-max gap-3 py-1 pr-3">
        {chips(false)}
        {chips(true)}
      </ul>
    </div>
  );
}
