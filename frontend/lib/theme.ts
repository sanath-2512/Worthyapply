"use client";

/**
 * Theme store. The single source of truth is the `data-theme` attribute on
 * <html>, set before first paint by the inline script in layout.tsx (no FOUC).
 * Components read it as an external store so every consumer — toggles, the
 * WebGL scene — stays in sync without a context/provider.
 */
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "worthyapply-theme";
const CHANGE_EVENT = "worthyapply:themechange";

export type Theme = "light" | "dark";

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab changing the preference should update this one too.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function applyTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // persistence unavailable (private mode) — theme still applies for the session
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useTheme(): Theme {
  // Server and first client render agree on "dark"; the real value arrives on
  // hydration, matching what the pre-paint script already put on <html>.
  return useSyncExternalStore(subscribe, readTheme, (): Theme => "dark");
}
