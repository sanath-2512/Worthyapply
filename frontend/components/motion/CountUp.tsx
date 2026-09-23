"use client";

/**
 * Number that counts up once when it scrolls into view (or on mount). The
 * text node is written directly each frame, so there is no React re-render per
 * tick. Screen readers get the final value only.
 */
import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";

interface Props {
  value: number;
  from?: number;
  duration?: number;
  delay?: number;
  suffix?: string;
  prefix?: string;
  trigger?: "mount" | "scroll";
  className?: string;
  style?: React.CSSProperties;
}

export function CountUp({ value, from = 0, duration = 1.6, delay = 0, suffix = "", prefix = "", trigger = "scroll", className = "", style }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  useGsap(
    ({ reduced, scope }) => {
      const node = numRef.current;
      if (!node) return;
      if (reduced) {
        node.textContent = String(value);
        return;
      }
      const state = { n: from };
      node.textContent = String(from);
      gsap.to(state, {
        n: value,
        duration,
        delay,
        ease: "expo.out",
        onUpdate: () => {
          node.textContent = String(Math.round(state.n));
        },
        scrollTrigger: trigger === "scroll" ? { trigger: scope, start: "top 90%", once: true } : undefined,
      });
    },
    [value, from, duration, delay, trigger],
    ref
  );

  return (
    <span ref={ref} className={`tabular ${className}`} style={style}>
      <span className="sr-only">
        {prefix}
        {value}
        {suffix}
      </span>
      <span aria-hidden="true">
        {prefix}
        <span ref={numRef}>{value}</span>
        {suffix}
      </span>
    </span>
  );
}
