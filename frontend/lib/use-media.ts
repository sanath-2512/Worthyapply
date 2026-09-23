"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribe to a media query without a mount-time state write. The server
 * snapshot is `serverDefault`, so markup is stable through hydration.
 */
export function useMediaQuery(query: string, serverDefault = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverDefault
  );
}

/** True when the user asked the OS for less motion. Server assumes reduced. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)", true);
}

/** Precise pointer with hover — gates cursor-driven effects off touch devices. */
export function useFinePointer(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)", false);
}
