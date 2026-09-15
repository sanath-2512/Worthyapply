"use client";

import { useState } from "react";
import { BulletImprovement } from "@/lib/types";
import { CopyButton } from "./CopyButton";
import { Icon } from "../ui/Icon";

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
      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text)" }}>
          What to change
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Truthful improvements grounded in your experience
        </p>
      </div>

      <div className="space-y-12">
        {/* Assessment */}
        <div
          className="p-6 rounded-2xl border"
          style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {assessment}
          </p>
        </div>

        {/* Priorities */}
        <div>
          <Label>Priority Actions</Label>
          {priorities.length > 0 ? (
            <div className="space-y-3">
              {priorities.map((p, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="shrink-0 w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-full"
                    style={{ background: "var(--accent-dim)", color: "var(--accent-bright)", fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{p}</p>
                </div>
              ))}
            </div>
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
            <Label>Resume Bullet Transformations</Label>
            <div className="space-y-5">
              {visible.map((b, i) => (
                <BulletCard key={i} bullet={b} />
              ))}
            </div>
            {bullets.length > 3 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-medium"
                style={{ color: "var(--accent-bright)" }}
              >
                View all {bullets.length} improvements <Icon name="arrow-right" size={13} />
              </button>
            )}
          </div>
        )}

        {/* Keywords */}
        <div>
          <Label>Keywords to Include</Label>
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg"
                  style={{ background: "var(--green-dim)", color: "var(--green)" }}
                >
                  <Icon name="check" size={12} /> {k}
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
            className="p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{
              background: "linear-gradient(135deg, var(--accent-dim) 0%, var(--surface) 100%)",
              borderColor: "var(--accent-glow)",
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                Ready to apply these optimizations?
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Generate a tailored resume version incorporating these targeted bullets and keywords.
              </p>
            </div>
            <button
              onClick={onScrollToTailor}
              className="btn btn-primary btn-sm magnetic-btn shrink-0"
            >
              <Icon name="sparkle" size={14} />
              <span>Tailor Resume</span>
              <Icon name="arrow-right" size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BulletCard({ bullet }: { bullet: BulletImprovement }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}
    >
      {/* Before */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
          Before
        </span>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {bullet.original}
        </p>
      </div>

      {/* After */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-elevated)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--green)" }}>
            After
          </span>
          <CopyButton text={bullet.improved} />
        </div>
        <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text)" }}>
          {bullet.improved}
        </p>
      </div>

      {/* Why */}
      <div className="px-5 py-3">
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <span className="font-semibold">Why:</span> {bullet.reason}
        </p>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-4" style={{ color: "var(--text-muted)" }}>
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
