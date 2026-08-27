"use client";

import { useState } from "react";
import { AnalysisResponse } from "@/lib/types";

interface Props {
  data: AnalysisResponse;
}

export function ApplicationBrief({ data }: Props) {
  const [copied, setCopied] = useState(false);

  const { job_analysis: ja, match_analysis: ma, resume_optimization: ro } = data;

  const strongestMatches = ma.matching_skills.slice(0, 4).join(" · ");
  const biggestGap = ma.skill_gaps[0] || "None";
  const topPriority = ro.priority_improvements[0] || "No critical changes needed";

  const briefText = `Role: ${ja.job_title} at ${ja.company}
Experience: ${ja.experience_required}
Match Score: ${ma.match_score}/100
Recommendation: ${ma.recommendation}
Strongest Match: ${strongestMatches}
Biggest Gap: ${biggestGap}
Top Priority: ${topPriority}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(briefText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = briefText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const recColor = ma.recommendation === "Apply" ? "var(--green)" : ma.recommendation === "Maybe" ? "var(--amber)" : "var(--red)";
  const recBg = ma.recommendation === "Apply" ? "var(--green-dim)" : ma.recommendation === "Maybe" ? "var(--amber-dim)" : "var(--red-dim)";

  return (
    <div>
      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text)" }}>
          Application Brief
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Your concise takeaway
        </p>
      </div>

      <div
        className="rounded-2xl border p-6 md:p-8 space-y-6"
        style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
      >
        {/* Role */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Role</span>
            <p className="text-lg font-bold mt-1" style={{ color: "var(--text)" }}>{ja.job_title}</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{ja.company} · {ja.experience_required}</p>
          </div>
          <span
            className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
            style={{ background: recBg, color: recColor }}
          >
            {ma.recommendation === "Apply" && "✓"}
            {ma.recommendation === "Maybe" && "~"}
            {ma.recommendation === "Do Not Apply" && "✕"}
            {ma.recommendation}
          </span>
        </div>

        <div className="h-px" style={{ background: "var(--border-subtle)" }} />

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BriefStat label="Score" value={`${ma.match_score}`} color={recColor} />
          <BriefStat label="Matched" value={`${ma.matching_skills.length}`} color="var(--green)" />
          <BriefStat label="Gaps" value={`${ma.skill_gaps.length}`} color={ma.skill_gaps.length > 0 ? "var(--amber)" : "var(--green)"} />
          <BriefStat label="Required" value={`${ma.required_skills.length}`} color="var(--text-secondary)" />
        </div>

        <div className="h-px" style={{ background: "var(--border-subtle)" }} />

        {/* Key info */}
        <div className="space-y-3">
          <BriefRow label="Strongest Match" value={strongestMatches} />
          <BriefRow label="Biggest Gap" value={biggestGap} />
          <BriefRow label="Top Priority" value={topPriority} />
        </div>

        <div className="h-px" style={{ background: "var(--border-subtle)" }} />

        {/* Copy */}
        <button
          onClick={handleCopy}
          className="magnetic-btn w-full py-3 rounded-xl text-sm font-medium transition-all duration-200"
          style={{
            background: copied ? "var(--green-dim)" : "var(--surface-elevated)",
            color: copied ? "var(--green)" : "var(--text-secondary)",
            border: `1px solid ${copied ? "var(--green)" : "var(--border)"}`,
          }}
        >
          {copied ? "Copied ✓" : "Copy Brief"}
        </button>
      </div>
    </div>
  );
}

function BriefStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold tabular-nums" style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div className="text-[9px] font-medium uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm text-right" style={{ color: "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}
