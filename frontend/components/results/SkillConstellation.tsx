"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Icon } from "../ui/Icon";

interface Props {
  matching: string[];
  gaps: string[];
  niceToHave: string[];
}

type NodeType = "match" | "gap" | "nice";

interface Node {
  label: string;
  type: NodeType;
  x: number;
  y: number;
}

// Each ring can only hold so many labels before they collide, so the radial view
// shows the first N of each group and the count of whatever is left. The full
// lists are always readable in "Where you stand" and in the chip view below.
const MAX_MATCH = 8;
const MAX_GAP = 6;
const MAX_NICE = 5;

const COLOR: Record<NodeType, string> = {
  match: "var(--green)",
  gap: "var(--amber)",
  nice: "var(--text-muted)",
};

const CHIP: Record<NodeType, string> = {
  match: "chip chip-match",
  gap: "chip chip-gap",
  nice: "chip chip-dashed",
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function SkillConstellation({ matching, gaps, niceToHave }: Props) {
  const shown = useMemo(
    () => ({
      match: matching.slice(0, MAX_MATCH),
      gap: gaps.slice(0, MAX_GAP),
      nice: niceToHave.slice(0, MAX_NICE),
    }),
    [matching, gaps, niceToHave]
  );

  const hidden =
    Math.max(0, matching.length - MAX_MATCH) +
    Math.max(0, gaps.length - MAX_GAP) +
    Math.max(0, niceToHave.length - MAX_NICE);

  const nodes = useMemo(() => {
    const all: Node[] = [];
    const cx = 50;
    const cy = 50;

    // Rings are spaced so labels on adjacent rings do not sit on top of each
    // other, and each ring's labels are spread evenly around the full circle.
    const place = (labels: string[], type: NodeType, radius: number, offset: number) => {
      labels.forEach((label, i) => {
        const angle = (i / Math.max(labels.length, 1)) * Math.PI * 2 + offset;
        all.push({
          label,
          type,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      });
    };

    place(shown.match, "match", 22, -Math.PI / 2);
    place(shown.gap, "gap", 35, Math.PI / 5);
    place(shown.nice, "nice", 45, Math.PI / 7);

    return all;
  }, [shown]);

  const isEmpty = matching.length === 0 && gaps.length === 0 && niceToHave.length === 0;

  if (isEmpty) return null;

  return (
    <div className="card relative overflow-hidden p-5 sm:p-8">
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" aria-hidden="true" />
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Skill map
          </h2>
          <p className="text-[14px] mt-1" style={{ color: "var(--text-secondary)" }}>
            Matched skills sit closest to you; gaps and nice-to-haves orbit further out.
          </p>
        </div>
        {/* Legend */}
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <Leg color="var(--green)" label="Matched" />
          <Leg color="var(--amber)" label="Gap" />
          <Leg color="var(--text-muted)" label="Nice to have" />
        </div>
      </div>

      {/* Radial view — only where there is room for it to stay legible. */}
      <div className="relative hidden sm:block">
        <div className="relative w-full max-w-[560px] mx-auto aspect-square">
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <defs>
              <radialGradient id="core-glow">
                <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.35 }} />
                <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="14" fill="url(#core-glow)" />
            {[22, 35, 45].map((r, i) => (
              <motion.circle
                key={r}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="var(--border)"
                strokeWidth={0.2 - i * 0.04}
                strokeDasharray={i === 0 ? "none" : "0.6 0.8"}
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: i * 0.15, ease: EASE }}
              />
            ))}

            {nodes
              .filter((n) => n.type === "match")
              .map((n, i) => (
                <motion.line
                  key={`l-${n.label}`}
                  x1="50"
                  y1="50"
                  x2={n.x}
                  y2={n.y}
                  stroke="var(--green)"
                  strokeOpacity="0.35"
                  strokeWidth="0.25"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.06, duration: 0.7, ease: EASE }}
                />
              ))}

            {nodes
              .filter((n) => n.type === "gap")
              .map((n) => (
                <line
                  key={`g-${n.label}`}
                  x1="50"
                  y1="50"
                  x2={n.x}
                  y2={n.y}
                  stroke="var(--amber)"
                  strokeOpacity="0.18"
                  strokeWidth="0.2"
                  strokeDasharray="0.8 0.8"
                />
              ))}

            <circle cx="50" cy="50" r="2.2" fill="var(--accent)" />
            <circle cx="50" cy="50" r="3.8" fill="none" stroke="var(--accent)" strokeWidth="0.25" opacity="0.4" />
          </svg>

          {/* Labels. Width is capped and text truncates so a long skill name
              cannot run off the edge of the map. */}
          {nodes.map((node, i) => (
            <motion.div
              key={`${node.type}-${node.label}`}
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 + i * 0.035, duration: 0.6, ease: EASE }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <span
                className={`${CHIP[node.type]} !text-[11px] !py-1 !px-2 max-w-[8.5rem] backdrop-blur-sm transition-transform duration-300 hover:scale-110 hover:z-10`}
                title={node.label}
              >
                {node.type === "match" && <Icon name="check" size={10} strokeWidth={2.5} />}
                {node.type === "gap" && <Icon name="x" size={10} strokeWidth={2.5} />}
                <span className="truncate">{node.label}</span>
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Small screens get the same information as readable grouped chips
          rather than a radial layout squeezed into a phone width. */}
      <div className="relative sm:hidden space-y-5 mt-4">
        <ChipGroup label="Matched" items={matching} type="match" />
        <ChipGroup label="Gaps" items={gaps} type="gap" />
        <ChipGroup label="Nice to have" items={niceToHave} type="nice" />
      </div>

      {hidden > 0 && (
        <p className="relative hidden sm:block text-center text-[12px] mt-3" style={{ color: "var(--text-muted)" }}>
          +{hidden} more listed in full below
        </p>
      )}
    </div>
  );
}

function ChipGroup({ label, items, type }: { label: string; items: string[]; type: NodeType }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] mb-2.5" style={{ color: COLOR[type] }}>
        {label} · {items.length}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span key={s} className={CHIP[type]}>
            {type === "match" && <Icon name="check" size={10} strokeWidth={2.5} />}
            {type === "gap" && <Icon name="x" size={10} strokeWidth={2.5} />}
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Leg({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}
