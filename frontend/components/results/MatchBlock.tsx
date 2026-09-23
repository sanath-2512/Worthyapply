"use client";

import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";
import { Icon } from "../ui/Icon";
import { SectionHeading } from "../ui/SectionHeading";
import { CountUp } from "../motion/CountUp";
import { EmptyNote } from "./shared";

interface Props {
  required: string[];
  matching: string[];
  gaps: string[];
}

export function MatchBlock({ required, matching, gaps }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Skill coverage, which is deliberately distinct from the weighted match
  // score in the hero: this counts requirements, that one weights them.
  const pct = Math.round((matching.length / Math.max(required.length, 1)) * 100);
  const barColor = pct >= 70 ? "var(--green)" : "var(--amber)";

  useGsap(
    ({ reduced, scope }) => {
      const bar = scope.querySelector("[data-bar]");
      if (!bar || reduced) return;
      gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: bar, start: "top 90%", once: true } });
      gsap.from(scope.querySelectorAll("[data-skill]"), {
        x: -10,
        autoAlpha: 0,
        duration: 0.6,
        stagger: 0.04,
        ease: "expo.out",
        scrollTrigger: { trigger: scope.querySelector("[data-cols]"), start: "top 85%", once: true },
      });
    },
    [pct],
    ref
  );

  return (
    <div ref={ref}>
      <SectionHeading eyebrow="Your fit" title="Where you stand" sub="Your skills compared against what the role requires." className="mb-10" />

      {/* Coverage */}
      <div className="card p-5 sm:p-6 mb-5">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>Skill coverage</p>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {matching.length} of {required.length} required skills evidenced
            </p>
          </div>
          <span className="text-3xl font-semibold tracking-tight" style={{ color: barColor }}>
            <CountUp value={pct} suffix="%" />
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "var(--surface-elevated)" }}
          role="img"
          aria-label={`${pct}% skill coverage`}
        >
          <div data-bar className="h-full rounded-full origin-left" style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 16px ${barColor}` }} />
        </div>
      </div>

      {/* Columns */}
      <div data-cols className="grid md:grid-cols-2 gap-5">
        <div className="card p-5 sm:p-6">
          <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] mb-4 flex items-center gap-2" style={{ color: "var(--green)" }}>
            <Icon name="check" size={13} strokeWidth={2.25} /> You have · {matching.length}
          </h3>
          {matching.length > 0 ? (
            <ul className="space-y-1.5">
              {matching.map((s) => (
                <li
                  data-skill
                  key={s}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium"
                  style={{ background: "var(--green-dim)", color: "var(--text)" }}
                >
                  <span style={{ color: "var(--green)" }}><Icon name="check" size={14} strokeWidth={2.25} /></span> {s}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>
              None of the required skills are clearly evidenced in your resume yet.
              If you do have them, make them explicit in your experience or projects —
              a skills list alone counts for little.
            </EmptyNote>
          )}
        </div>

        <div className="card p-5 sm:p-6">
          <h3
            className="text-[11px] font-mono uppercase tracking-[0.14em] mb-4 flex items-center gap-2"
            style={{ color: gaps.length > 0 ? "var(--amber)" : "var(--green)" }}
          >
            {gaps.length > 0 ? (
              <><Icon name="alert" size={13} /> Gaps · {gaps.length}</>
            ) : (
              <><Icon name="check" size={13} /> No gaps</>
            )}
          </h3>
          {gaps.length > 0 ? (
            <ul className="space-y-1.5">
              {gaps.map((s) => (
                <li
                  data-skill
                  key={s}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium"
                  style={{ background: "var(--amber-dim)", color: "var(--text)" }}
                >
                  <span style={{ color: "var(--amber)" }}><Icon name="x" size={14} strokeWidth={2.25} /></span> {s}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
                <Icon name="check" size={20} strokeWidth={2.25} />
              </span>
              <p className="text-[14px] font-medium" style={{ color: "var(--text)" }}>All required skills covered</p>
              <p className="text-[12.5px] mt-1" style={{ color: "var(--text-muted)" }}>Nothing missing from the requirements list.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
