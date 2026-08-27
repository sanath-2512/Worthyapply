"use client";

import { useState } from "react";

interface Props {
  summary: string;
  missing: string[];
  warnings: string[];
}

export function DetailsBlock({ summary, missing, warnings }: Props) {
  return (
    <div>
      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text)" }}>
          Full details
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Complete analysis for deeper review
        </p>
      </div>

      <div className="space-y-4">
        <Accordion title="Job Summary" defaultOpen>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {summary}
          </p>
        </Accordion>

        {missing.length > 0 && (
          <Accordion title={`Weak / Missing Requirements (${missing.length})`}>
            <div className="space-y-2.5">
              {missing.map((m, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--amber)" }}>⚠</span>
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </Accordion>
        )}

        {warnings.length > 0 && (
          <Accordion title={`Warnings (${warnings.length})`}>
            <div className="p-4 rounded-xl space-y-2.5" style={{ background: "var(--red-dim)" }}>
              {warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--red)" }}>
                  <span className="shrink-0">!</span>
                  <span>{w}</span>
                </p>
              ))}
            </div>
          </Accordion>
        )}
      </div>
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
          {title}
        </span>
        <span
          className="text-[10px] transition-transform duration-200"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}
