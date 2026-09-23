"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "../ui/Icon";
import { SectionHeading } from "../ui/SectionHeading";
import { Accordion } from "../ui/Accordion";
import { EmptyNote, Label } from "./shared";

interface Props {
  technical: string[];
  soft: string[];
  responsibilities: string[];
  keywords: string[];
  niceToHave: string[];
}

export function RequirementsBlock({ technical, soft, responsibilities, keywords, niceToHave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? responsibilities : responsibilities.slice(0, 5);

  return (
    <div>
      <SectionHeading eyebrow="The role" title="What this role requires" sub="Key requirements extracted from the job description." className="mb-10" />

      <div className="grid lg:grid-cols-[1fr_1.15fr] gap-5">
        <div className="space-y-5">
          <div className="card p-5 sm:p-6">
            <Label>Technical skills</Label>
            {technical.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {technical.map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
            ) : (
              <EmptyNote>
                This job description doesn&apos;t name specific technical skills. Lean on
                the responsibilities to judge what the role actually involves.
              </EmptyNote>
            )}
          </div>

          {soft.length > 0 && (
            <div className="card p-5 sm:p-6">
              <Label>Soft skills</Label>
              <div className="flex flex-wrap gap-2">
                {soft.map((s) => <span key={s} className="chip" style={{ color: "var(--text-secondary)" }}>{s}</span>)}
              </div>
            </div>
          )}

          {keywords.length > 0 && (
            <div className="card p-5 sm:p-6">
              <Label>Keywords</Label>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((k) => <span key={k} className="chip chip-accent">{k}</span>)}
              </div>
            </div>
          )}
        </div>

        {/* Responsibilities */}
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <Label>Responsibilities</Label>
            {responsibilities.length > 0 && (
              <span className="text-[11px] font-mono mb-3" style={{ color: "var(--text-muted)" }}>{responsibilities.length}</span>
            )}
          </div>
          {responsibilities.length === 0 && (
            <EmptyNote>No day-to-day responsibilities were spelled out in this posting.</EmptyNote>
          )}
          <ol className="space-y-3">
            <AnimatePresence initial={false}>
              {visible.map((r, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: i >= 5 ? (i - 5) * 0.03 : 0 }}
                  className="flex items-start gap-3"
                >
                  <span
                    className="shrink-0 text-[10.5px] font-mono w-6 h-6 flex items-center justify-center rounded-md mt-0.5"
                    style={{ background: "var(--surface-elevated)", color: "var(--text-muted)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {r}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          {responsibilities.length > 5 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium group"
              style={{ color: "var(--accent-bright)" }}
              aria-expanded={expanded}
            >
              {expanded ? "Show fewer" : `Show all ${responsibilities.length}`}
              <span className="inline-flex transition-transform duration-300" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
                <Icon name="chevron-down" size={14} />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Nice to Have */}
      {niceToHave.length > 0 && (
        <div className="mt-5">
          <Accordion title="Nice to have" icon="sparkle" meta={<span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{niceToHave.length}</span>}>
            <div className="flex flex-wrap gap-2">
              {niceToHave.map((s) => <span key={s} className="chip chip-dashed">{s}</span>)}
            </div>
          </Accordion>
        </div>
      )}
    </div>
  );
}
