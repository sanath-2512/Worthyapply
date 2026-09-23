"use client";

/**
 * Lenis smooth scrolling, driven by GSAP's ticker so Lenis and ScrollTrigger
 * read the same frame — no jitter, no double easing. Mounted only on the
 * long-form marketing/analysis surface; the resume builder keeps native
 * scrolling because it is a tool with its own scroll panes.
 *
 * Disabled entirely under prefers-reduced-motion, where native scrolling
 * (without smooth behaviour) is the respectful default.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

type Target = number | string | HTMLElement;

interface ScrollApi {
  /** Scroll to an element id (without #), element, or y offset. */
  scrollTo: (target: Target, opts?: { offset?: number; immediate?: boolean }) => void;
}

const ScrollContext = createContext<ScrollApi | null>(null);

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch devices keep native momentum scrolling — it is already smooth,
      // and emulating it is where mobile jank usually comes from.
      syncTouch: false,
      // Textareas and preview panes inside the page scroll themselves first.
      allowNestedScroll: true,
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollTo = useCallback<ScrollApi["scrollTo"]>((target, opts = {}) => {
    const { offset = 0, immediate = false } = opts;
    const el =
      typeof target === "string"
        ? document.getElementById(target)
        : typeof target === "number"
        ? null
        : target;
    if (typeof target === "string" && !el) return;

    const lenis = lenisRef.current;
    if (lenis) {
      // An immediate jump usually follows a view swap; re-measure first so the
      // target isn't clamped to the previous page's height.
      if (immediate) lenis.resize();
      lenis.scrollTo(el ?? (target as number), { offset, immediate, duration: 1.25 });
      return;
    }
    const top = el ? el.getBoundingClientRect().top + window.scrollY + offset : (target as number);
    window.scrollTo({ top, behavior: immediate || prefersReducedMotion() ? "auto" : "smooth" });
  }, []);

  const api = useMemo(() => ({ scrollTo }), [scrollTo]);

  return <ScrollContext.Provider value={api}>{children}</ScrollContext.Provider>;
}

/** Falls back to native scrolling when used outside SmoothScroll. */
export function useSmoothScroll(): ScrollApi {
  const ctx = useContext(ScrollContext);
  return (
    ctx ?? {
      scrollTo: (target, opts = {}) => {
        const el = typeof target === "string" ? document.getElementById(target) : typeof target === "number" ? null : target;
        const top = el ? el.getBoundingClientRect().top + window.scrollY + (opts.offset ?? 0) : (target as number);
        window.scrollTo({ top, behavior: opts.immediate || prefersReducedMotion() ? "auto" : "smooth" });
      },
    }
  );
}
