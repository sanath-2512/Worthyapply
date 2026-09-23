"use client";

import { Icon } from "../ui/Icon";
import { Accordion } from "../ui/Accordion";
import { SectionHeading } from "../ui/SectionHeading";

interface Props {
  summary: string;
  missing: string[];
  warnings: string[];
}

export function DetailsBlock({ summary, missing, warnings }: Props) {
  return (
    <div>
      <SectionHeading eyebrow="Reference" title="Full details" sub="The complete analysis, for a deeper review." className="mb-10" />

      <div className="space-y-3">
        <Accordion title="Job summary" icon="document" defaultOpen>
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {summary}
          </p>
        </Accordion>

        {missing.length > 0 && (
          <Accordion
            title="Weak or missing requirements"
            icon="alert"
            tone="var(--amber)"
            meta={<span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>{missing.length}</span>}
          >
            <ul className="space-y-2.5">
              {missing.map((m, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  <span className="mt-1 shrink-0" style={{ color: "var(--amber)" }}><Icon name="alert" size={13} /></span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </Accordion>
        )}

        {warnings.length > 0 && (
          <Accordion
            title="Warnings"
            icon="alert"
            tone="var(--red)"
            meta={<span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--red-dim)", color: "var(--red)" }}>{warnings.length}</span>}
          >
            <ul className="p-4 rounded-xl space-y-2.5" style={{ background: "var(--red-dim)" }}>
              {warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed" style={{ color: "var(--text)" }}>
                  <span className="mt-1 shrink-0" style={{ color: "var(--red)" }}><Icon name="alert" size={13} /></span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Accordion>
        )}
      </div>
    </div>
  );
}
