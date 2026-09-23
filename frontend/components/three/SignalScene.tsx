"use client";

/**
 * Decides whether and how to run the WebGL signal field, and always renders
 * something good-looking:
 *
 *  - Server / first paint / no WebGL / Save-Data: a static CSS + SVG
 *    rendition of the same form (SceneFallback). Never a blank box.
 *  - WebGL available: three.js is fetched lazily after the page is idle, then
 *    cross-fades in over the fallback.
 *  - Particle count and pixel ratio scale with the device; phones get a
 *    lighter field.
 *  - Off-screen: the render loop stops (IntersectionObserver).
 *  - Reduced motion: a single still frame of the resolved form.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useTheme } from "@/lib/theme";
import { useReducedMotion } from "@/lib/use-media";
import type { SceneDriver } from "./driver";
import { SceneFallback } from "./SceneFallback";

const SignalField = dynamic(() => import("./SignalField"), { ssr: false });

let webglSupport: boolean | null = null;
function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const c = document.createElement("canvas");
    webglSupport = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function saveData(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return Boolean(nav.connection?.saveData);
}

const noop = () => () => {};
function useCanRunWebGL() {
  return useSyncExternalStore(noop, () => hasWebGL() && !saveData(), () => false);
}

function deviceTier() {
  const w = window.innerWidth;
  const cores = navigator.hardwareConcurrency || 4;
  const low = cores <= 4;
  if (w < 768) return { count: low ? 1800 : 2800, dpr: [1, 1.5] as [number, number] };
  return { count: low ? 4200 : 7000, dpr: [1, 1.75] as [number, number] };
}

interface Props {
  /** Mutable scene inputs; written by page code, read by the scene each frame. */
  driver: RefObject<SceneDriver>;
  className?: string;
  /** Horizontal offset of the form in world units on wide screens. */
  offsetX?: number;
  /** Follow the pointer (hero). */
  interactive?: boolean;
}

export function SignalScene({ driver, className = "", offsetX = 0, interactive = true }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const canRun = useCanRunWebGL();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [idle, setIdle] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<{ count: number; dpr: [number, number]; wide: boolean } | null>(null);

  // Mount the canvas only once the browser is idle, so three.js never
  // competes with first paint or hydration.
  useEffect(() => {
    if (!canRun) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const go = () => {
      const t = deviceTier();
      setTier({ ...t, wide: window.innerWidth >= 1024 });
      setIdle(true);
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(go, { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(go, 300);
    return () => window.clearTimeout(id);
  }, [canRun]);

  // Pause rendering when scrolled out of view.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Pointer → driver (fine pointers only; touch gets no parallax).
  useEffect(() => {
    if (!interactive || reduced) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      driver.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      driver.current.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [driver, interactive, reduced]);

  const showCanvas = canRun && idle && tier;

  return (
    <div ref={wrapRef} className={`pointer-events-none select-none ${className}`} aria-hidden="true">
      <div
        className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
        style={{ opacity: showCanvas && ready ? 0 : 1 }}
      >
        <SceneFallback offset={tier?.wide ? offsetX : 0} />
      </div>
      {showCanvas && (
        <div className="absolute inset-0 transition-opacity duration-[1400ms] ease-out" style={{ opacity: ready ? 1 : 0 }}>
          <SignalField
            driver={driver}
            count={tier.count}
            dpr={tier.dpr}
            theme={theme}
            animate={!reduced}
            active={visible}
            offsetX={tier.wide ? offsetX : 0}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  );
}
