"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Runs `build` once, scoped to `scope` (selector strings only match inside it),
 * and undoes every tween and ScrollTrigger on unmount.
 *
 * The markup is written in its finished state; scenes animate *from* somewhere.
 * So with "reduce motion" switched on, `build` never runs and people see the
 * final frame, still and complete.
 */
export function useMotion(scope: RefObject<HTMLElement | null>, build: (el: HTMLElement) => void | (() => void)) {
  const buildRef = useRef(build);
  useIsoLayoutEffect(() => {
    const el = scope.current;
    if (!el) return;
    const mm = gsap.matchMedia(el);
    mm.add("(prefers-reduced-motion: no-preference)", () => buildRef.current(el));
    return () => mm.revert();
  }, [scope]);
}

/** A looping scene that plays while on screen and pauses when scrolled away. */
export function sceneTimeline(trigger: Element, vars: gsap.TimelineVars = {}) {
  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.2, defaults: { ease: "power2.out" }, ...vars });
  ScrollTrigger.create({
    trigger,
    start: "top 75%",
    end: "bottom 20%",
    onEnter: () => tl.play(),
    onEnterBack: () => tl.play(),
    onLeave: () => tl.pause(),
    onLeaveBack: () => tl.pause(),
  });
  return tl;
}

/** Counts from one number to another inside `el`, formatted by `format`. */
export function countTo(
  tl: gsap.core.Timeline,
  el: Element | null,
  range: { from?: number; to: number },
  format: (n: number) => string,
  vars: gsap.TweenVars = {},
  at?: gsap.Position,
) {
  if (!el) return;
  const state = { v: range.from ?? 0 };
  tl.fromTo(
    state,
    { v: range.from ?? 0 },
    {
      v: range.to,
      duration: 1,
      ease: "power1.out",
      onUpdate: () => {
        el.textContent = format(state.v);
      },
      ...vars,
    },
    at,
  );
}

export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
