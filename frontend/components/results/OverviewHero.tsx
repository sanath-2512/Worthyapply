"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

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
}

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
}: Props) {
  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setAnimScore(score); return; }

    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setAnimScore(Math.round(eased * score));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  const color = score >= 70 ? "var(--green)" : score >= 45 ? "var(--amber)" : "var(--red)";
  const recColor = recommendation === "Apply" ? "var(--green)" : recommendation === "Maybe" ? "var(--amber)" : "var(--red)";
  const recBg = recommendation === "Apply" ? "var(--green-dim)" : recommendation === "Maybe" ? "var(--amber-dim)" : "var(--red-dim)";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Section label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="text-center text-[10px] font-bold uppercase tracking-[0.3em] mb-8"
        style={{ color: "var(--accent-bright)" }}
      >
        Application Intelligence
      </motion.p>

      {/* Score — dominant visual */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6, type: "spring", stiffness: 120 }}
        >
          <span
            className="text-[8rem] md:text-[10rem] lg:text-[12rem] font-black leading-none tabular-nums block"
            style={{ color, fontFamily: "'Inter', sans-serif" }}
          >
            {animScore}
          </span>
        </motion.div>
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-[10px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: "var(--text-muted)" }}
        >
          Match Score
        </motion.span>
      </div>

      {/* Job info + recommendation */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight mb-2"
          style={{ color: "var(--text)" }}
        >
          {jobTitle}
        </h1>
        <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
          {company} · {experience}
        </p>
        <span
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
          style={{ background: recBg, color: recColor }}
        >
          {recommendation === "Apply" && "✓"}
          {recommendation === "Maybe" && "~"}
          {recommendation === "Do Not Apply" && "✕"}
          {recommendation}
        </span>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-10"
      >
        <Stat value={matched} label="Matched" color="var(--green)" />
        <Stat value={gaps} label="Gaps" color={gaps > 0 ? "var(--amber)" : "var(--green)"} />
        <Stat value={total} label="Required" color="var(--text-secondary)" />
      </motion.div>

      {/* Reason */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="max-w-lg mx-auto text-center"
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {reason}
        </p>
      </motion.div>
    </motion.div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div
      className="text-center py-4 rounded-2xl border"
      style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}
    >
      <div
        className="text-xl font-bold tabular-nums"
        style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {value}
      </div>
      <div className="text-[9px] font-medium uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
