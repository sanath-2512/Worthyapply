"use client";

/**
 * Global light/dark theme toggle.
 *
 * The single source of truth is the `data-theme` attribute on <html>, which is
 * set before first paint by the inline script in layout.tsx (no FOUC). This
 * button reads that attribute on mount, toggles it live, and persists the choice
 * to localStorage. No context/provider needed — any instance stays in sync
 * because they all read/write the same DOM attribute + storage key.
 */
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

const STORAGE_KEY = "worthyapply-theme";
type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Sync from the DOM after hydration (initial render stays SSR-safe/neutral).
  useEffect(() => {
    const t = currentTheme();
    setTheme((prev) => (prev === t ? prev : t));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = currentTheme() === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // persistence unavailable (private mode) — theme still applies for the session
    }
    setTheme(next);
  };

  const isLight = theme === "light";
  const label = mounted
    ? `Switch to ${isLight ? "dark" : "light"} mode`
    : "Toggle theme";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`icon-btn ${className}`}
      style={{ color: "var(--text-secondary)" }}
      aria-label={label}
      title={label}
    >
      {/* Before mount, render a neutral icon to avoid hydration mismatch. */}
      <Icon name={mounted && isLight ? "moon" : "sun"} size={17} />
    </button>
  );
}
