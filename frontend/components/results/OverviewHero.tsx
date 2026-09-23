"use client";

import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { ScoreRing } from "../ui/ScoreRing";
import { CountUp } from "../motion/CountUp";
import { useMediaQuery } from "@/lib/use-media";

interface Props {
  jobTitle: string;
  company: string;
  experience: string;
  score: number;
  recommendation: "Apply" | "Maybe" | "Do Not Apply";
  reason: string;
  matched: number;
  gaps: number;
  total: number;
  onScrollToTailor?: () => void;
}

const VERDICT = {
  Apply: { color: "var(--green)", bg: "var(--green-dim)", icon: "check" as const, line: "Strong fit — worth applying." },
  Maybe: { color: "var(--amber)", bg: "var(--amber-dim)", icon: "alert" as const, line: "Borderline — tailor before you apply." },
  "Do Not Apply": { color: "var(--red)", bg: "var(--red-dim)", icon: "x" as const, line: "Significant gaps for this role." },
};

export function OverviewHero({
  jobTitle,
  company,
  experience,
  score,
  recommendation,
  reason,
  matched,
  gaps,
  total,
  onScrollToTailor,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const large = useMediaQuery("(min-width: 640px)", true);

  const color = score >= 70 ? "var(--green)" : score >= 45 ? "var(--amber)" : "var(--red)";
  const verdict = VERDICT[recommendation] ?? VERDICT.Maybe;

  useGsap(
    ({ reduced, scope }) => {
      if (reduced) return;
      gsap.from(scope.querySelectorAll("[data-ov]"), {
        y: 22,
        autoAlpha: 0,
        filter: "blur(6px)",
        duration: 1.1,
        stagger: 0.07,
        delay: 0.15,
        ease: "expo.out",
        clearProps: "filter",
      });
      gsap.from(scope.querySelector("[data-ring]"), { scale: 0.86, autoAlpha: 0, duration: 1.4, ease: "expo.out", delay: 0.05 });
    },
    [],
    ref
  );

  return (
    <div ref={ref} className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-12 items-center">
      {/* Score */}
      <div data-ring className="relative md:order-2 flex justify-center">
        <div
          className="absolute inset-0 m-auto w-[80%] aspect-square rounded-full blur-3xl opacity-50"
          style={{ background: `radial-gradient(circle, color-mix(in srgb, ${color} 35%, transparent), transparent 65%)` }}
          aria-hidden="true"
        />
        <ScoreRing score={score} color={color} size={large ? 300 : 230} stroke={large ? 12 : 10} delay={0.35} />
      </div>

      {/* Verdict */}
      <div className="md:order-1 text-center md:text-left">
        <p data-ov className="eyebrow mb-4 justify-center md:justify-start">
          <span className="w-4 h-px" style={{ background: "currentColor" }} aria-hidden="true" />
          Application intelligence
        </p>
        <h1 data-ov className="display-md break-words" style={{ color: "var(--text)" }}>
          {jobTitle}
        </h1>
        <p data-ov className="mt-3 text-[15px]" style={{ color: "var(--text-secondary)" }}>
          {company} <span style={{ color: "var(--border-strong)" }}>·</span> {experience}
        </p>

        <div data-ov className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-3">
          <span className="pill" style={{ background: verdict.bg, color: verdict.color }}>
            <Icon name={verdict.icon} size={13} strokeWidth={2.25} />
            {recommendation}
          </span>
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{verdict.line}</span>
        </div>

        <p data-ov className="mt-5 text-[15px] leading-relaxed max-w-xl mx-auto md:mx-0" style={{ color: "var(--text-secondary)" }}>
          {reason}
        </p>

        {/* Stats */}
        <dl data-ov className="mt-8 grid grid-cols-3 max-w-md mx-auto md:mx-0 rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}>
          <Stat value={matched} label="Matched" color="var(--green)" />
          <Stat value={gaps} label="Gaps" color={gaps > 0 ? "var(--amber)" : "var(--green)"} border />
          <Stat value={total} label="Required" color="var(--text)" border />
        </dl>

        {onScrollToTailor && (
          <div data-ov className="mt-8 flex justify-center md:justify-start">
            <Button magnetic onClick={onScrollToTailor} iconLeft="sparkle" iconRight="arrow-right">
              Generate Tailored Resume
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, color, border }: { value: number; label: string; color: string; border?: boolean }) {
  // dt precedes dd in the DOM (valid <dl>); flex order puts the number on top.
  return (
    <div className={`py-4 px-3 text-center flex flex-col ${border ? "border-l" : ""}`} style={{ borderColor: "var(--border-subtle)" }}>
      <dt className="order-2 text-[11px] font-mono uppercase tracking-[0.12em] mt-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="order-1 text-2xl font-semibold tracking-tight" style={{ color }}>
        <CountUp value={value} trigger="mount" delay={0.6} duration={1.2} />
      </dd>
    </div>
  );
}
