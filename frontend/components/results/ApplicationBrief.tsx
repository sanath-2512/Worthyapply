"use client";

import { useState } from "react";
import { AnalysisResponse } from "@/lib/types";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { SectionHeading } from "../ui/SectionHeading";
import { useToast } from "../ui/Toast";
import { copyText } from "./CopyButton";

interface Props {
  data: AnalysisResponse;
}

export function ApplicationBrief({ data }: Props) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

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
    await copyText(briefText);
    setCopied(true);
    toast("Application brief copied");
    setTimeout(() => setCopied(false), 2500);
  };

  const recColor = ma.recommendation === "Apply" ? "var(--green)" : ma.recommendation === "Maybe" ? "var(--amber)" : "var(--red)";
  const recBg = ma.recommendation === "Apply" ? "var(--green-dim)" : ma.recommendation === "Maybe" ? "var(--amber-dim)" : "var(--red-dim)";

  return (
    <div>
      <SectionHeading eyebrow="Takeaway" title="Application brief" sub="Your concise summary — copy it into your notes or tracker." className="mb-10" />

      <div className="card-elevated overflow-hidden">
        {/* Role */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Role</span>
            <p className="text-xl font-semibold tracking-tight mt-1.5 break-words" style={{ color: "var(--text)" }}>{ja.job_title}</p>
            <p className="text-[14px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{ja.company} · {ja.experience_required}</p>
          </div>
          <span className="pill shrink-0 self-start" style={{ background: recBg, color: recColor }}>
            {ma.recommendation === "Apply" && <Icon name="check" size={12} />}
            {ma.recommendation === "Maybe" && <Icon name="alert" size={12} />}
            {ma.recommendation === "Do Not Apply" && <Icon name="x" size={12} />}
            {ma.recommendation}
          </span>
        </div>

        {/* Key metrics */}
        {/* gap-px over a border-coloured backdrop draws hairlines between cells at every breakpoint */}
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-px border-y" style={{ borderColor: "var(--border-subtle)", background: "var(--border-subtle)" }}>
          <BriefStat label="Score" value={`${ma.match_score}`} color={recColor} />
          <BriefStat label="Matched" value={`${ma.matching_skills.length}`} color="var(--green)" />
          <BriefStat label="Gaps" value={`${ma.skill_gaps.length}`} color={ma.skill_gaps.length > 0 ? "var(--amber)" : "var(--green)"} />
          <BriefStat label="Required" value={`${ma.required_skills.length}`} color="var(--text)" />
        </dl>

        {/* Key info */}
        <dl className="p-6 sm:p-8 space-y-4">
          <BriefRow label="Strongest match" value={strongestMatches} />
          <BriefRow label="Biggest gap" value={biggestGap} />
          <BriefRow label="Top priority" value={topPriority} />
        </dl>

        {/* Copy */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
          <Button variant={copied ? "secondary" : "primary"} fullWidth onClick={handleCopy} iconLeft={copied ? "check" : "copy"}>
            {copied ? "Copied" : "Copy brief"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BriefStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col text-center py-5" style={{ background: "var(--surface)" }}>
      <dt className="order-2 text-[11px] font-mono uppercase tracking-[0.12em] mt-1" style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="order-1 text-2xl font-semibold tabular tracking-tight" style={{ color }}>{value}</dd>
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
      <dt className="text-[11px] font-mono uppercase tracking-[0.12em] pt-0.5" style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="text-[14px] leading-relaxed" style={{ color: "var(--text)" }}>{value}</dd>
    </div>
  );
}
