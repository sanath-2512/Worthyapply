import { useId } from "react";

/**
 * WorthyApply mark: a "W" drawn as a signal trace — the product turns a noisy
 * job post into a clear fit signal. Pure SVG, inherits nothing but size.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  // Unique gradient id per instance — several marks can share a page.
  const id = `wa-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--accent-bright)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent)" }} />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill={`url(#${id})`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="none" stroke="rgba(255,255,255,0.25)" />
      <path
        d="M7.5 10.5 11.2 21.5 16 13.5 20.8 21.5 24.5 10.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 28, showWordmark = true, className = "" }: { size?: number; showWordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text)" }}>
          WorthyApply
        </span>
      )}
    </span>
  );
}
