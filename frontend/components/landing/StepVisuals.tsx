/**
 * Product vignettes for "How it works". Each is a small, honest mock of a real
 * screen — the inputs, the explainable score, the tailored resume in the
 * editor. Elements carry data-attributes so the pinned timeline can animate
 * their internals; with no timeline they simply render in their final state.
 */
import { Icon } from "../ui/Icon";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-elevated overflow-hidden w-full">
      <div className="flex items-center gap-2 px-4 h-10 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border-strong)" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
        <span className="ml-2 text-[11px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
          {title}
        </span>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

export function InputsVisual() {
  return (
    <Frame title="new-analysis">
      <p className="text-[10px] font-mono uppercase tracking-[0.16em] mb-2" style={{ color: "var(--text-muted)" }}>
        01 · Resume
      </p>
      <div data-step-item className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--green-glow)" }}>
        <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
          <Icon name="document" size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>alex-rivera-resume.pdf</p>
          <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>142 KB · ready</p>
        </div>
        <Icon name="check" size={16} style={{ color: "var(--green)" }} />
      </div>
      <p className="text-[10px] font-mono uppercase tracking-[0.16em] mt-5 mb-2" style={{ color: "var(--text-muted)" }}>
        02 · Job description
      </p>
      <div data-step-item className="p-4 rounded-xl space-y-2.5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
        <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>Frontend Engineer — Platform</p>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Build product UI with <mark className="chip-accent px-1 rounded">React</mark> and{" "}
          <mark className="chip-accent px-1 rounded">TypeScript</mark>, integrate{" "}
          <mark className="chip-accent px-1 rounded">REST APIs</mark>, and ship to{" "}
          <mark className="chip-accent px-1 rounded">Kubernetes</mark>…
        </p>
        <div className="space-y-1.5 pt-1">
          <div className="h-1.5 rounded-full w-full" style={{ background: "var(--surface-elevated)" }} />
          <div className="h-1.5 rounded-full w-4/5" style={{ background: "var(--surface-elevated)" }} />
        </div>
      </div>
    </Frame>
  );
}

const RINGS_C = 2 * Math.PI * 34;

const REQS: { label: string; state: "yes" | "partial" | "no"; note: string }[] = [
  { label: "React", state: "yes", note: "3 roles, 2 projects" },
  { label: "TypeScript", state: "yes", note: "Current role" },
  { label: "REST APIs", state: "partial", note: "Implied, not explicit" },
  { label: "Kubernetes", state: "no", note: "Not in resume" },
];

const STATE = {
  yes: { icon: "check" as const, color: "var(--green)", bg: "var(--green-dim)", label: "Matched" },
  partial: { icon: "alert" as const, color: "var(--amber)", bg: "var(--amber-dim)", label: "Partial" },
  no: { icon: "x" as const, color: "var(--red)", bg: "var(--red-dim)", label: "Missing" },
};

export function ScoreVisual() {
  return (
    <Frame title="analysis · explainable score">
      <div className="flex items-center gap-5">
        <div className="relative w-[92px] h-[92px] shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-elevated)" strokeWidth="6" />
            <circle
              data-demo-arc
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="var(--green)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RINGS_C}
              strokeDashoffset={RINGS_C * (1 - 0.74)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold tabular tracking-tight" style={{ color: "var(--text)" }}>
            <span data-demo-score>74</span>
          </span>
        </div>
        <div>
          <span className="pill" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
            <Icon name="check" size={12} /> Apply
          </span>
          <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Strong on the core stack. One infra gap, flagged — not hidden.
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {REQS.map((r) => {
          const s = STATE[r.state];
          return (
            <li data-step-item key={r.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
              <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: s.bg, color: s.color }}>
                <Icon name={s.icon} size={12} strokeWidth={2.5} />
              </span>
              <span className="text-[13px] font-medium flex-1 min-w-0 truncate" style={{ color: "var(--text)" }}>{r.label}</span>
              <span className="hidden sm:inline text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{r.note}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: s.color }}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

export function EditorVisual() {
  return (
    <Frame title="resume-builder · tailored">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: "var(--accent-dim)", color: "var(--accent-bright)" }}>
          <Icon name="sparkle" size={12} /> 4 changes applied
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md" style={{ background: "var(--accent)", color: "#fff" }}>
          <Icon name="download" size={12} /> PDF
        </span>
      </div>
      {/* A4-ish page */}
      <div className="rounded-lg p-4 sm:p-5 space-y-3" style={{ background: "#fff", color: "#111" }}>
        <div>
          <div className="h-3 w-32 rounded" style={{ background: "#111" }} />
          <div className="h-1.5 w-48 rounded mt-2" style={{ background: "#d4d4dc" }} />
        </div>
        <div className="h-px" style={{ background: "#e4e4ea" }} />
        <div className="space-y-2">
          <div className="h-2 w-24 rounded" style={{ background: "#444" }} />
          <div data-step-item className="rounded px-2 py-1.5 text-[11px] leading-snug" style={{ background: "rgba(61,214,140,0.14)", color: "#0b3d27" }}>
            Developed a React application integrating REST APIs for dynamic data retrieval.
          </div>
          <div className="h-1.5 w-full rounded" style={{ background: "#e4e4ea" }} />
          <div className="h-1.5 w-5/6 rounded" style={{ background: "#e4e4ea" }} />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-16 rounded" style={{ background: "#444" }} />
          <div data-step-item className="rounded px-2 py-1.5 text-[11px] leading-snug" style={{ background: "rgba(91,124,255,0.12)", color: "#1c2a73" }}>
            Skills: React, TypeScript, REST APIs, Jest
          </div>
        </div>
      </div>
    </Frame>
  );
}
