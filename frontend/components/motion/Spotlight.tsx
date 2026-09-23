"use client";

/**
 * Card with a pointer-following glow (see `.spotlight` in globals.css). The
 * pointer position is written straight to CSS variables — no React state, so
 * moving the mouse never re-renders the card.
 */
import { useRef } from "react";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function Spotlight({ className = "", onPointerMove, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (el && e.pointerType === "mouse") {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", `${e.clientX - r.left}px`);
      el.style.setProperty("--py", `${e.clientY - r.top}px`);
    }
    onPointerMove?.(e);
  };
  return (
    <div ref={ref} className={`spotlight ${className}`} onPointerMove={handleMove} {...rest}>
      {children}
    </div>
  );
}
