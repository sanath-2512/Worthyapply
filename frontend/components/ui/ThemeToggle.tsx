"use client";

/**
 * Global light/dark theme toggle. State lives on <html data-theme> (see
 * lib/theme.ts), so every instance on the page stays in sync.
 */
import { applyTheme, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme();
  const isLight = theme === "light";
  const label = `Switch to ${isLight ? "dark" : "light"} mode`;

  return (
    <button
      type="button"
      onClick={() => applyTheme(isLight ? "dark" : "light")}
      className={`icon-btn relative overflow-hidden ${className}`}
      style={{ color: "var(--text-secondary)" }}
      aria-label={label}
      title={label}
    >
      {/* Both glyphs are rendered; the inactive one rotates out of view. */}
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: isLight ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.4)", opacity: isLight ? 1 : 0 }}
      >
        <Icon name="moon" size={17} />
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: isLight ? "rotate(90deg) scale(0.4)" : "rotate(0deg) scale(1)", opacity: isLight ? 0 : 1 }}
      >
        <Icon name="sun" size={17} />
      </span>
    </button>
  );
}
