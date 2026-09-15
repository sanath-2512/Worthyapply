"use client";

import { useState } from "react";
import { Icon } from "../ui/Icon";

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
      <SectionHeader title="What this role requires" sub="Key requirements from the job description" />

      <div className="space-y-10">
        {/* Technical */}
        <div>
          <Label>Technical Skills</Label>
          {technical.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {technical.map((s) => <Chip key={s}>{s}</Chip>)}
            </div>
          ) : (
            <EmptyNote>
              This job description doesn&apos;t name specific technical skills. Lean on
              the responsibilities below to judge what the role actually involves.
            </EmptyNote>
          )}
        </div>

        {soft.length > 0 && (
          <div>
            <Label>Soft Skills</Label>
            <div className="flex flex-wrap gap-2">
              {soft.map((s) => <Chip key={s} muted>{s}</Chip>)}
            </div>
          </div>
        )}

        {/* Responsibilities */}
        <div>
          <Label>Responsibilities</Label>
          {responsibilities.length === 0 && (
            <EmptyNote>No day-to-day responsibilities were spelled out in this posting.</EmptyNote>
          )}
          <div className="space-y-2.5">
            {visible.map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className="shrink-0 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-md mt-0.5"
                  style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {r}
                </span>
              </div>
            ))}
          </div>
          {responsibilities.length > 5 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium"
              style={{ color: "var(--accent-bright)" }}
            >
              Show all {responsibilities.length}
              <Icon name="arrow-right" size={13} />
            </button>
          )}
        </div>

        {/* Keywords */}
        {keywords.length > 0 && (
          <div>
            <Label>Keywords</Label>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "var(--accent-dim)", color: "var(--accent-bright)" }}
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Nice to Have */}
        {niceToHave.length > 0 && <Collapsible title={`Nice to Have (${niceToHave.length})`}>
          <div className="flex flex-wrap gap-2">
            {niceToHave.map((s) => (
              <span
                key={s}
                className="text-[11px] px-2.5 py-1 rounded-lg"
                style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}
              >
                {s}
              </span>
            ))}
          </div>
        </Collapsible>}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </h3>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[13px] leading-relaxed rounded-xl border border-dashed px-4 py-3.5"
      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
    >
      {children}
    </p>
  );
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className="text-[11px] font-medium px-3 py-1.5 rounded-lg"
      style={{
        background: "var(--surface-elevated)",
        color: muted ? "var(--text-muted)" : "var(--text)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {children}
    </span>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{ color: "var(--text-muted)" }}
      >
        <span className="inline-flex transition-transform duration-150" style={{ transform: open ? "rotate(90deg)" : "rotate(0)" }}><Icon name="chevron-right" size={14} /></span>
        {title}
      </button>
      {open && <div className="mt-3 ml-4">{children}</div>}
    </div>
  );
}
