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

const BG: Record<NodeType, string> = {
  match: "var(--green-dim)",
  gap: "var(--amber-dim)",
  nice: "var(--surface-elevated)",
};

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
    <div>
      <div className="text-center mb-4">
        <h3
          className="text-[10px] font-bold uppercase tracking-[0.25em]"
          style={{ color: "var(--text-muted)" }}
        >
          Skill Map
        </h3>
      </div>

      {/* Radial view — only where there is room for it to stay legible. */}
      <div className="hidden sm:block">
        <div className="relative w-full max-w-lg mx-auto aspect-square">
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <circle cx="50" cy="50" r="22" fill="none" stroke="var(--border-subtle)" strokeWidth="0.2" />
            <circle cx="50" cy="50" r="35" fill="none" stroke="var(--border-subtle)" strokeWidth="0.15" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border-subtle)" strokeWidth="0.1" />

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
                  strokeOpacity="0.25"
                  strokeWidth="0.25"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.5 }}
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
                  strokeOpacity="0.12"
                  strokeWidth="0.2"
                  strokeDasharray="0.8 0.8"
                />
              ))}

            <circle cx="50" cy="50" r="2" fill="var(--accent)" opacity="0.9" />
            <circle cx="50" cy="50" r="3.5" fill="none" stroke="var(--accent)" strokeWidth="0.2" opacity="0.3" />
          </svg>

          {/* Labels. Width is capped and text truncates so a long skill name
              cannot run off the edge of the map. */}
          {nodes.map((node, i) => (
            <motion.div
              key={`${node.type}-${node.label}`}
              initial={{ opacity: 0, scale: 0.4 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute text-[10px] font-medium px-1.5 py-0.5 rounded max-w-[7.5rem] truncate -translate-x-1/2 -translate-y-1/2"
              title={node.label}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                background: BG[node.type],
                color: COLOR[node.type],
                border: node.type === "nice" ? "1px solid var(--border)" : "none",
              }}
            >
              <span className="inline-flex items-center gap-1 align-middle">
                {node.type === "match" && <Icon name="check" size={10} strokeWidth={2.5} />}
                {node.type === "gap" && <Icon name="x" size={10} strokeWidth={2.5} />}
                {node.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Small screens get the same information as readable grouped chips
          rather than a radial layout squeezed into a phone width. */}
      <div className="sm:hidden space-y-4">
        <ChipGroup label="Matched" items={matching} type="match" />
        <ChipGroup label="Gaps" items={gaps} type="gap" />
        <ChipGroup label="Nice to have" items={niceToHave} type="nice" />
      </div>

      {/* Legend */}
      <div className="hidden sm:flex items-center justify-center gap-6 mt-6">
        <Leg color="var(--green)" label="Matched" />
        <Leg color="var(--amber)" label="Gap" />
        <Leg color="var(--text-muted)" label="Nice to have" />
      </div>

      {hidden > 0 && (
        <p className="hidden sm:block text-center text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
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
      <h4
        className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2"
        style={{ color: COLOR[type] }}
      >
        {label} ({items.length})
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg"
            style={{
              background: BG[type],
              color: COLOR[type],
              border: type === "nice" ? "1px solid var(--border)" : "none",
            }}
          >
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
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}
