"use client";

interface Props {
  required: string[];
  matching: string[];
  gaps: string[];
  score: number;
}

export function MatchBlock({ required, matching, gaps, score }: Props) {
  const pct = Math.round((matching.length / Math.max(required.length, 1)) * 100);
  const barColor = pct >= 70 ? "var(--green)" : "var(--amber)";

  return (
    <div>
      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text)" }}>
          Where you stand
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Skills comparison against requirements
        </p>
      </div>

      {/* Progress */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {matching.length} of {required.length} skills
          </span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: barColor, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {pct}%
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>

      {/* Columns */}
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3
            className="text-[10px] font-bold uppercase tracking-[0.15em] mb-4 flex items-center gap-1.5"
            style={{ color: "var(--green)" }}
          >
            ✓ You have ({matching.length})
          </h3>
          <div className="space-y-1.5">
            {matching.map((s) => (
              <div
                key={s}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--green-dim)", color: "var(--green)" }}
              >
                <span className="text-[10px]">✓</span> {s}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3
            className="text-[10px] font-bold uppercase tracking-[0.15em] mb-4 flex items-center gap-1.5"
            style={{ color: gaps.length > 0 ? "var(--amber)" : "var(--green)" }}
          >
            {gaps.length > 0 ? `⚠ Gaps (${gaps.length})` : "✓ No gaps"}
          </h3>
          {gaps.length > 0 ? (
            <div className="space-y-1.5">
              {gaps.map((s) => (
                <div
                  key={s}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
                  style={{ background: "var(--amber-dim)", color: "var(--amber)" }}
                >
                  <span className="text-[10px]">✕</span> {s}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              All required skills covered.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
