"use client";

/**
 * Single entry point for GSAP. Plugins are registered once, on the client, and
 * every animation in the app reads its timing from the tokens below so motion
 * stays consistent: short and decisive for interaction, longer only for
 * one-off entrances.
 */
import { useEffect, useLayoutEffect, useRef, type DependencyList, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: "expo.out", duration: 0.9 });
}

export { gsap, ScrollTrigger, SplitText };

export const EASE = {
  /** Entrances: fast start, long settle. */
  out: "expo.out",
  /** State changes and scrubbed timelines. */
  inOut: "power3.inOut",
  soft: "power2.out",
} as const;

export const DUR = { fast: 0.25, base: 0.6, slow: 1.1 } as const;

export const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Run GSAP code inside a gsap.context scoped to `scope`, reverting every tween,
 * ScrollTrigger and SplitText it created when deps change or on unmount. This
 * is what keeps route/view changes free of orphaned triggers.
 *
 * The callback receives `reduced` so each animation can choose a static end
 * state instead of motion when the user asks for less of it.
 */
export function useGsap(
  callback: (ctx: { reduced: boolean; scope: HTMLElement }) => void | (() => void),
  deps: DependencyList,
  scope: RefObject<HTMLElement | null>
) {
  const cbRef = useRef(callback);
  useIsomorphicLayoutEffect(() => {
    cbRef.current = callback;
  });

  useIsomorphicLayoutEffect(() => {
    const el = scope.current;
    if (!el) return;
    const reduced = prefersReducedMotion();
    let cleanup: void | (() => void);
    const ctx = gsap.context(() => {
      cleanup = cbRef.current({ reduced, scope: el });
    }, el);
    return () => {
      if (typeof cleanup === "function") cleanup();
      ctx.revert();
    };
  }, deps);
}
