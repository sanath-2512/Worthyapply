"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface Props {
  matching: string[];
  gaps: string[];
  niceToHave: string[];
}

interface Node {
  label: string;
  type: "match" | "gap" | "nice";
  x: number;
  y: number;
}

export function SkillConstellation({ matching, gaps, niceToHave }: Props) {
  const nodes = useMemo(() => {
    const all: Node[] = [];
    const cx = 50, cy = 50;

    matching.forEach((s, i) => {
      const angle = (i / Math.max(matching.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const r = 20 + (i % 3) * 5;
      all.push({ label: s, type: "match", x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    });

    gaps.forEach((s, i) => {
      const angle = (i / Math.max(gaps.length, 1)) * Math.PI * 2 + Math.PI / 5;
      const r = 34 + (i % 2) * 4;
      all.push({ label: s, type: "gap", x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    });

    niceToHave.slice(0, 6).forEach((s, i) => {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 7;
      const r = 41;
      all.push({ label: s, type: "nice", x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    });

    return all;
  }, [matching, gaps, niceToHave]);

  const getColor = (t: Node["type"]) => t === "match" ? "var(--green)" : t === "gap" ? "var(--amber)" : "var(--text-muted)";
  const getBg = (t: Node["type"]) => t === "match" ? "var(--green-dim)" : t === "gap" ? "var(--amber-dim)" : "var(--surface-elevated)";

  return (
    <div>
      <div className="text-center mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text-muted)" }}>
          Skill Map
        </h3>
      </div>

      <div className="relative w-full max-w-lg mx-auto aspect-square">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
          {/* Concentric rings */}
          <circle cx="50" cy="50" r="20" fill="none" stroke="var(--border-subtle)" strokeWidth="0.2" />
          <circle cx="50" cy="50" r="34" fill="none" stroke="var(--border-subtle)" strokeWidth="0.15" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-subtle)" strokeWidth="0.1" />

          {/* Connection lines to matches */}
          {nodes.filter(n => n.type === "match").map((n, i) => (
            <motion.line
              key={`l-${i}`}
              x1="50" y1="50" x2={n.x} y2={n.y}
              stroke="var(--green)" strokeOpacity="0.25" strokeWidth="0.25"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
            />
          ))}

          {/* Dashed lines to gaps */}
          {nodes.filter(n => n.type === "gap").map((n, i) => (
            <line
              key={`g-${i}`}
              x1="50" y1="50" x2={n.x} y2={n.y}
              stroke="var(--amber)" strokeOpacity="0.12" strokeWidth="0.2" strokeDasharray="0.8 0.8"
            />
          ))}

          {/* Center */}
          <circle cx="50" cy="50" r="2" fill="var(--accent)" opacity="0.9" />
          <circle cx="50" cy="50" r="3.5" fill="none" stroke="var(--accent)" strokeWidth="0.2" opacity="0.3" />
        </svg>

        {/* Labels */}
        {nodes.map((node, i) => (
          <motion.div
            key={`${node.type}-${node.label}`}
            initial={{ opacity: 0, scale: 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute text-[8px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              background: getBg(node.type),
              color: getColor(node.type),
              border: node.type === "nice" ? "1px solid var(--border)" : "none",
            }}
          >
            {node.type === "match" && "✓ "}{node.type === "gap" && "✕ "}{node.label}
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6">
        <Leg color="var(--green)" label="Matched" />
        <Leg color="var(--amber)" label="Gap" />
        <Leg color="var(--text-muted)" label="Nice to have" />
      </div>
    </div>
  );
}

function Leg({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}
