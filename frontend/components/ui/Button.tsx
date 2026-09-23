"use client";

/**
 * Button system. Variants and sizes map onto the .btn classes in globals.css;
 * this component adds the parts CSS can't: a loading state that keeps the
 * button's width, trailing-icon nudge on hover, and optional magnetism.
 */
import Link from "next/link";
import { forwardRef } from "react";
import { Icon, type IconName } from "./Icon";
import { Magnetic } from "../motion/Magnetic";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  iconLeft?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  magnetic?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function classes({ variant = "primary", size = "md", fullWidth, className = "" }: BaseProps) {
  const sizeClass = size === "md" ? "" : `btn-${size}`;
  return `btn btn-${variant} ${sizeClass} group ${fullWidth ? "w-full" : ""} ${className}`.trim();
}

function iconSize(size: Size = "md") {
  return size === "lg" ? 18 : size === "xs" ? 13 : 16;
}

function Inner({ iconLeft, iconRight, loading, size, children }: BaseProps) {
  const s = iconSize(size);
  return (
    <>
      <span className="btn-label inline-flex items-center gap-[inherit] transition-opacity">
        {iconLeft && <Icon name={iconLeft} size={s} />}
        {children}
        {iconRight && (
          <span className="inline-flex transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5">
            <Icon name={iconRight} size={s} />
          </span>
        )}
      </span>
      {loading && (
        <span className="btn-spinner" aria-hidden="true">
          <span className="spinner" style={{ width: s, height: s }} />
        </span>
      )}
    </>
  );
}

type ButtonProps = BaseProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, iconLeft, iconRight, loading, magnetic, fullWidth, className, children, disabled, type = "button", ...rest },
  ref
) {
  // Inside the magnetic wrapper the button fills it, so stacked mobile layouts
  // (items-stretch) still get a full-width target.
  const btn = (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, fullWidth, className: `${magnetic ? "flex-1" : ""} ${className ?? ""}` })}
      disabled={disabled || loading}
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Inner iconLeft={iconLeft} iconRight={iconRight} loading={loading} size={size}>
        {children}
      </Inner>
    </button>
  );
  return magnetic ? <Magnetic className={fullWidth ? "w-full" : ""}>{btn}</Magnetic> : btn;
});

type LinkProps = BaseProps & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href">;

export function ButtonLink({ variant, size, iconLeft, iconRight, magnetic, fullWidth, className, children, href, ...rest }: LinkProps) {
  const link = (
    <Link href={href} className={classes({ variant, size, fullWidth, className: `${magnetic ? "flex-1" : ""} ${className ?? ""}` })} {...rest}>
      <Inner iconLeft={iconLeft} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </Link>
  );
  return magnetic ? <Magnetic className={fullWidth ? "w-full" : ""}>{link}</Magnetic> : link;
}
