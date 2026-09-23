"use client";

/**
 * Consistent, accessible Back control.
 *
 * Navigation-only (no business logic). History-first with a deterministic
 * parent fallback: when a real previous in-app entry exists we go back through
 * browser history so Forward still works and context is restored; otherwise we
 * invoke `onFallback` to move to the logical parent screen (prevents dead-ends
 * on reload / direct load).
 */
import { Icon } from "./Icon";

interface Props {
  /** Visible + accessible label, e.g. "Back" or "Back to Workspace". */
  label?: string;
  /**
   * Called when there is no usable browser history to go back to. Should move
   * the app to the logical parent screen deterministically.
   */
  onFallback: () => void;
  /**
   * True when this screen was reached via a pushed history entry (so
   * history.back() will land on the correct previous screen). When false we go
   * straight to the fallback.
   */
  canGoBack?: boolean;
  className?: string;
  /** Hide the text label below the sm breakpoint (icon stays, label stays for AT). */
  compact?: boolean;
}

export function BackButton({ label = "Back", onFallback, canGoBack = true, className = "", compact = true }: Props) {
  const handle = () => {
    if (canGoBack && typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      onFallback();
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      aria-label={label}
      className={`group inline-flex items-center gap-1.5 h-9 pl-2 pr-2.5 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--surface-elevated)] ${className}`}
      style={{ color: "var(--text-secondary)" }}
    >
      <span className="inline-flex transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-0.5">
        <Icon name="arrow-left" size={16} />
      </span>
      <span className={compact ? "hidden sm:inline" : ""}>{label}</span>
    </button>
  );
}
