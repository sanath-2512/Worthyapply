"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BulletImprovement } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { SectionHeading } from "../ui/SectionHeading";
import { Spotlight } from "../motion/Spotlight";
import { EmptyNote, Label } from "./shared";

interface Props {
  assessment: string;
  priorities: string[];
  bullets: BulletImprovement[];
  keywords: string[];
  onScrollToTailor?: () => void;
}

export function ImprovementsBlock({ assessment, priorities, bullets, keywords, onScrollToTailor }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? bullets : bullets.slice(0, 3);

  return (
    <div>
      <SectionHeading eyebrow="Optimization" title="What to change" sub="Truthful improvements, grounded in your actual experience." className="mb-10" />

      <div className="space-y-12">
        {/* Assessment */}
        <figure className="relative card p-6 sm:p-7 overflow-hidden">
          <span className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r" style={{ background: "linear-gradient(var(--accent), var(--accent-2))" }} aria-hidden="true" />
          <figcaption className="text-[11px] font-mono uppercase tracking-[0.14em] mb-2" style={{ color: "var(--text-muted)" }}>
            Overall assessment
          </figcaption>
          <p className="text-[15px] leading-relaxed" style={{ color: "var(--text)" }}>
            {assessment}
          </p>
        </figure>

        {/* Priorities */}
        <div>
          <Label>Priority actions</Label>
          {priorities.length > 0 ? (
            <ol className="grid sm:grid-cols-2 gap-3">
              {priorities.map((p, i) => (
                <li key={i} className="card p-4 flex items-start gap-3">
                  <span
                    className="shrink-0 w-7 h-7 flex items-center justify-center text-[12px] font-mono rounded-lg"
                    style={{ background: "var(--accent-dim)", color: "var(--accent-bright)" }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[14px] leading-relaxed pt-0.5" style={{ color: "var(--text-secondary)" }}>{p}</p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyNote>
              No priority rewrites were flagged for this role — your resume already
              speaks to what the job asks for. Review the sections below for smaller
              wording gains.
            </EmptyNote>
          )}
        </div>

        {/* Bullet Improvements */}
        {bullets.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <Label>Resume bullet transformations</Label>
              <span className="text-[11px] font-mono mb-3" style={{ color: "var(--text-muted)" }}>{bullets.length}</span>
            </div>
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {visible.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i >= 3 ? (i - 3) * 0.06 : 0 }}
                  >
                    <BulletCard bullet={b} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {bullets.length > 3 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium"
                style={{ color: "var(--accent-bright)" }}
                aria-expanded={showAll}
              >
                {showAll ? "Show fewer" : `View all ${bullets.length} improvements`}
                <span className="inline-flex transition-transform duration-300" style={{ transform: showAll ? "rotate(180deg)" : "none" }}>
                  <Icon name="chevron-down" size={14} />
                </span>
              </button>
            )}
          </div>
        )}

        {/* Keywords */}
        <div>
          <Label>Keywords to include</Label>
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((k) => (
                <span key={k} className="chip chip-match">
                  <Icon name="check" size={11} strokeWidth={2.5} /> {k}
                </span>
              ))}
            </div>
          ) : (
            <EmptyNote>
              Nothing to add here. WorthyApply only suggests keywords your resume
              genuinely supports, and the terms this job uses are already covered —
              or they belong to gaps you should not claim.
            </EmptyNote>
          )}
        </div>

        {/* Action prompt */}
        {onScrollToTailor && (
          <div
            className="relative p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden"
            style={{ background: "linear-gradient(120deg, var(--accent-dim) 0%, var(--surface) 70%)", borderColor: "var(--accent-glow)" }}
          >
            <div className="flex items-start gap-3.5">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--accent)", color: "#fff" }}>
                <Icon name="sparkle" size={16} />
              </span>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
                  Ready to apply these optimizations?
                </p>
                <p className="text-[13px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Generate a tailored resume incorporating these targeted bullets and keywords.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={onScrollToTailor} iconLeft="sparkle" iconRight="arrow-right" className="shrink-0">
              Tailor Resume
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function BulletCard({ bullet }: { bullet: BulletImprovement }) {
  return (
    <Spotlight className="card overflow-hidden grid md:grid-cols-2">
      {/* Before */}
      <div className="p-5 border-b md:border-b-0 md:border-r" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="text-[10.5px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
          Before
        </span>
        <p className="text-[14px] mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {bullet.original}
        </p>
      </div>

      {/* After */}
      <div className="p-5" style={{ background: "color-mix(in srgb, var(--green) 5%, transparent)" }}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[10.5px] font-mono uppercase tracking-[0.14em] inline-flex items-center gap-1.5" style={{ color: "var(--green)" }}>
            <Icon name="arrow-right" size={11} /> After
          </span>
          <CopyButton text={bullet.improved} />
        </div>
        <p className="text-[14px] font-medium leading-relaxed" style={{ color: "var(--text)" }}>
          {bullet.improved}
        </p>
      </div>

      {/* Why */}
      <div className="md:col-span-2 px-5 py-3 border-t flex items-start gap-2" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="mt-0.5 shrink-0" style={{ color: "var(--accent-bright)" }}><Icon name="sparkle" size={12} /></span>
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Why:</span> {bullet.reason}
        </p>
      </div>
    </Spotlight>
  );
}
