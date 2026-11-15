"use client";

import { useRef } from "react";
import { countTo, sceneTimeline, usd0, useMotion } from "./motion";

// A $2,000 budget paid back in four monthly parts of $500, drawn as the
// logo's ring split into portions. Each pay-out drops into the pocket.
const TOTAL = 2000;
const PART = 500;
const MONTHS = ["1 Feb", "1 Mar", "1 Apr", "1 May"];
const COLORS = ["#0089ff", "#5cb3ff", "#b8dcff", "#4d7cff"];
const CX = 130;
const CY = 110;
const R = 78;
const GAP = 14; // degrees between portions

function arc(i: number): string {
  const start = -90 + i * 90 + GAP / 2;
  const end = start + 90 - GAP;
  const pt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(CX + R * Math.cos(rad)).toFixed(2)} ${(CY + R * Math.sin(rad)).toFixed(2)}`;
  };
  return `M ${pt(start)} A ${R} ${R} 0 0 1 ${pt(end)}`;
}

/** The still frame (and where the scene pauses longest): two of four parts paid. */
const PAID_IN_STILL = 2;

export function BudgetScene() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (el) => {
    const tl = sceneTimeline(el, { repeatDelay: 1.6 });
    const left = el.querySelector(".js-left");
    const paid = el.querySelector(".js-paid");
    const next = el.querySelector(".js-next");
    const count = el.querySelector(".js-count");

    // Start of the budget: everything still locked.
    tl.set(".js-part", { autoAlpha: 1, x: 0, y: 0, scale: 1, transformOrigin: "50% 50%" })
      .set(".js-marker", { left: "0%" })
      .set(".js-month", { opacity: 0.4 })
      .call(() => {
        if (left) left.textContent = usd0(TOTAL);
        if (paid) paid.textContent = usd0(0);
        if (next) next.textContent = MONTHS[0];
        if (count) count.textContent = `0 of ${MONTHS.length}`;
      })
      .fromTo(".js-part", { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, stagger: 0.12, duration: 0.5, ease: "back.out(1.8)" });

    MONTHS.forEach((m, i) => {
      const at = `month${i}`;
      tl.addLabel(at, i === 0 ? "+=0.5" : "+=0.9")
        .to(".js-marker", { left: `${(i / (MONTHS.length - 1)) * 100}%`, duration: 0.7, ease: "power2.inOut" }, at)
        .to(`.js-month-${i}`, { opacity: 1, duration: 0.3 }, `${at}+=0.4`)
        // The month's portion leaves the ring and drops into the pocket.
        .to(`.js-part-${i}`, { x: CX - arcMid(i).x, y: 268 - arcMid(i).y, scale: 0.25, duration: 0.8, ease: "power2.in" }, `${at}+=0.5`)
        .to(`.js-part-${i}`, { autoAlpha: 0, duration: 0.15 }, `${at}+=1.2`)
        .to(".js-pocket", { scaleY: 0.85, transformOrigin: "50% 100%", duration: 0.12, yoyo: true, repeat: 1 }, `${at}+=1.25`)
        .call(
          () => {
            if (next) next.textContent = MONTHS[i + 1] ?? "Done";
            if (count) count.textContent = `${i + 1} of ${MONTHS.length}`;
          },
          [],
          `${at}+=1.25`,
        );
      countTo(tl, left, { from: TOTAL - i * PART, to: TOTAL - (i + 1) * PART }, usd0, { duration: 0.6 }, `${at}+=1.25`);
      countTo(tl, paid, { from: i * PART, to: (i + 1) * PART }, usd0, { duration: 0.6 }, `${at}+=1.25`);
      tl.fromTo(".js-plus", { autoAlpha: 0, y: 0 }, { autoAlpha: 1, y: -18, duration: 0.5 }, `${at}+=1.3`).to(".js-plus", { autoAlpha: 0, duration: 0.3 }, `${at}+=1.9`);
    });
    tl.to({}, { duration: 1.2 });
  });

  return (
    <div ref={ref} className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[auto_1fr] lg:gap-14">
      <div className="relative mx-auto w-full max-w-[300px]" role="img" aria-label="A $2,000 budget drawn as a ring of four $500 parts. On the first of each month one part drops into the free-to-spend pocket.">
        <svg viewBox="0 0 260 310" className="w-full overflow-visible" aria-hidden>
          {/* Ghosts: where each part was. */}
          {MONTHS.map((m, i) => (
            <path key={`g${m}`} d={arc(i)} fill="none" stroke="var(--border)" strokeWidth="22" strokeLinecap="round" />
          ))}
          {MONTHS.map((m, i) => (
            <path
              key={m}
              className={`js-part js-part-${i}`}
              d={arc(i)}
              fill="none"
              stroke={COLORS[i]}
              strokeWidth="22"
              strokeLinecap="round"
              opacity={i < PAID_IN_STILL ? 0 : 1}
            />
          ))}
          <text x={CX} y={CY - 6} textAnchor="middle" className="fill-text-muted text-[11px] font-semibold">
            Left in budget
          </text>
          <text x={CX} y={CY + 20} textAnchor="middle" className="js-left num display fill-text text-[26px]">
            {usd0(TOTAL - PAID_IN_STILL * PART)}
          </text>
          {/* The pocket from the logo. */}
          <g className="js-pocket">
            <path d="M80 248 Q130 266 180 248 L180 280 Q180 304 156 304 L104 304 Q80 304 80 280 Z" fill="#0935d1" />
          </g>
          <text x={CX} y={238} textAnchor="middle" className="js-plus fill-positive text-[14px] font-bold" opacity="0">
            +$500
          </text>
        </svg>
      </div>

      <div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Paid to you" valueClass="js-paid text-positive" value={usd0(PAID_IN_STILL * PART)} />
          <Stat label="Next pay-out" valueClass="js-next" value={MONTHS[PAID_IN_STILL]} />
          <Stat label="Parts paid" valueClass="js-count" value={`${PAID_IN_STILL} of ${MONTHS.length}`} />
        </div>

        {/* The months, with a marker moving along them. */}
        <div className="relative mt-8 px-1">
          <div className="h-1.5 rounded-full bg-border" />
          <span
            className="js-marker absolute top-[3px] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-surface-raised bg-hero shadow"
            style={{ left: `${((PAID_IN_STILL - 1) / (MONTHS.length - 1)) * 100}%` }}
          />
          <div className="mt-3 flex justify-between text-sm">
            {MONTHS.map((m, i) => (
              <span key={m} className={`js-month js-month-${i} num font-semibold ${i < PAID_IN_STILL ? "" : "opacity-40"}`}>
                {m}
              </span>
            ))}
          </div>
        </div>

        <ul className="mt-8 space-y-3 text-text-muted">
          <li className="flex gap-3">
            <Dot /> Put $2,000 in once. Stow pays it back to you, $500 on the first of each month, like a salary to yourself.
          </li>
          <li className="flex gap-3">
            <Dot /> Each part frees itself on its date. Nothing to remember, nothing to release.
          </li>
          <li className="flex gap-3">
            <Dot /> Spend more than this month&apos;s part and the app says no. Next month comes round anyway.
          </li>
        </ul>
      </div>
    </div>
  );
}

function arcMid(i: number) {
  const rad = ((-90 + i * 90 + 45) * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-surface-raised p-3.5 sm:p-4">
      <p className="text-xs font-semibold text-text-muted">{label}</p>
      <p className={`num display mt-1 text-lg sm:text-xl ${valueClass}`}>{value}</p>
    </div>
  );
}

function Dot() {
  return <span className="mt-2 size-1.5 shrink-0 rounded-full bg-hero" aria-hidden />;
}
