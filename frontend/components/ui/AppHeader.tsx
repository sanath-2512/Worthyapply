"use client";

/**
 * Header for the in-app screens (workspace, processing, results, builder).
 * Glass, sticky, and consistent: back + brand + breadcrumb on the left, a
 * contextual slot in the middle, status/actions on the right.
 */
import Link from "next/link";
import { Logo } from "./Logo";

interface Props {
  back?: React.ReactNode;
  /** Trailing crumb after the brand, e.g. "Resume Builder". */
  crumb?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  /** Link target for the brand mark. */
  homeHref?: string;
  onHome?: () => void;
  sticky?: boolean;
  maxWidth?: string;
  className?: string;
}

export function AppHeader({
  back,
  crumb,
  center,
  right,
  homeHref = "/",
  onHome,
  sticky = true,
  maxWidth = "max-w-[1200px]",
  className = "",
}: Props) {
  const brand = <Logo size={26} showWordmark={false} />;
  return (
    <header
      className={`${sticky ? "sticky top-0" : "relative"} z-50 border-b print:hidden ${className}`}
      style={{
        background: "var(--nav-bg)",
        borderColor: "var(--border-subtle)",
        backdropFilter: "blur(20px) saturate(150%)",
        WebkitBackdropFilter: "blur(20px) saturate(150%)",
      }}
    >
      <div className={`${maxWidth} mx-auto h-[var(--header-h)] px-[var(--gutter)] flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {back}
          {back && <span className="hidden sm:block w-px h-5" style={{ background: "var(--border)" }} aria-hidden="true" />}
          {onHome ? (
            <button type="button" onClick={onHome} className="rounded-lg" aria-label="WorthyApply home">
              {brand}
            </button>
          ) : (
            <Link href={homeHref} className="rounded-lg" aria-label="WorthyApply home">
              {brand}
            </Link>
          )}
          {crumb && (
            <span className="hidden sm:inline-flex items-center gap-2 text-[13px] min-w-0" style={{ color: "var(--text-muted)" }}>
              <span aria-hidden="true" style={{ color: "var(--border-strong)" }}>/</span>
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>{crumb}</span>
            </span>
          )}
        </div>
        {center && <div className="hidden md:flex min-w-0 flex-1 justify-center">{center}</div>}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">{right}</div>
      </div>
    </header>
  );
}
