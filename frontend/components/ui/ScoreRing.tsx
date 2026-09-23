"use client";

/**
 * Circular score gauge. The arc and the number animate together from a single
 * GSAP tween, so they can never drift apart. Announces the final score once.
 */
import { useId, useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";

interface Props {
  score: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
  delay?: number;
  trigger?: "mount" | "scroll";
  /** Visual size of the number inside, as a CSS font-size. */
  numberSize?: string;
}

export function ScoreRing({ score, color, size = 240, stroke = 10, label = "Match score", delay = 0.2, trigger = "mount", numberSize }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const glowId = `ring-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));

  useGsap(
    ({ reduced, scope }) => {
      const arc = arcRef.current;
      const num = numRef.current;
      if (!arc || !num) return;
      const end = c * (1 - clamped / 100);
      const setArc = (v: number) => {
        arc.style.strokeDashoffset = String(v);
        if (glowRef.current) glowRef.current.style.strokeDashoffset = String(v);
      };
      if (reduced) {
        setArc(end);
        num.textContent = String(clamped);
        return;
      }
      const state = { p: 0 };
      setArc(c);
      num.textContent = "0";
      gsap.to(state, {
        p: 1,
        duration: 1.8,
        delay,
        ease: "expo.out",
        onUpdate: () => {
          setArc(c - (c - end) * state.p);
          num.textContent = String(Math.round(clamped * state.p));
        },
        scrollTrigger: trigger === "scroll" ? { trigger: scope, start: "top 85%", once: true } : undefined,
      });
    },
    [clamped, c, delay, trigger],
    ref
  );

  // Tick marks every 10 points give the gauge an instrument feel.
  const ticks = Array.from({ length: 40 }, (_, i) => i);

  return (
    <div ref={ref} className="relative mx-auto" style={{ width: size, height: size, maxWidth: "100%", aspectRatio: "1" }}>
      <span className="sr-only">
        {label}: {clamped} out of 100
      </span>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const inner = r - stroke - 6;
          const outer = inner - (i % 4 === 0 ? 7 : 3);
          return (
            <line
              key={i}
              x1={size / 2 + Math.cos(a) * inner}
              y1={size / 2 + Math.sin(a) * inner}
              x2={size / 2 + Math.cos(a) * outer}
              y2={size / 2 + Math.sin(a) * outer}
              stroke="var(--border-strong)"
              strokeWidth={i % 4 === 0 ? 1.4 : 1}
              opacity={i % 4 === 0 ? 0.9 : 0.5}
            />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-elevated)" strokeWidth={stroke} />
        {/* Soft glow under the arc */}
        <circle
          ref={glowRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          opacity={0.35}
          filter={`url(#${glowId})`}
        />
        <circle
          ref={arcRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span
          ref={numRef}
          className="font-semibold tabular leading-none tracking-[-0.05em]"
          style={{ color: "var(--text)", fontSize: numberSize ?? `${size * 0.3}px` }}
        >
          {clamped}
        </span>
        <span className="mt-2 text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
          of 100
        </span>
      </div>
    </div>
  );
}
