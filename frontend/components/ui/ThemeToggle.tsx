"use client";

/**
 * Global light/dark theme toggle.
 *
 * The single source of truth is the `data-theme` attribute on <html>, which is
 * set before first paint by the inline script in layout.tsx (no FOUC). This
 * button reads that attribute as an external store and writes to it, so every
 * instance on the page stays in sync without a context/provider.
 */
import { useSyncExternalStore } from "react";
import { Icon } from "./Icon";

const STORAGE_KEY = "worthyapply-theme";
const CHANGE_EVENT = "worthyapply:themechange";

type Theme = "light" | "dark";

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

function applyTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // persistence unavailable (private mode) — theme still applies for the session
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Server and first client render agree on "dark"; the real value arrives on
  // hydration, matching what the pre-paint script already put on <html>.
  const theme = useSyncExternalStore(subscribe, readTheme, (): Theme => "dark");

  const isLight = theme === "light";
  const label = `Switch to ${isLight ? "dark" : "light"} mode`;

  return (
    <button
      type="button"
      onClick={() => applyTheme(isLight ? "dark" : "light")}
      className={`icon-btn ${className}`}
      style={{ color: "var(--text-secondary)" }}
      aria-label={label}
      title={label}
    >
      <Icon name={isLight ? "moon" : "sun"} size={17} />
    </button>
  );
}
