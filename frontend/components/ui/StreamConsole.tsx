/**
 * Live model-output tail. Shows only the last characters so the box stays a
 * fixed size while tokens stream in; the text is decorative progress, so it is
 * hidden from screen readers (the status line next to it is announced instead).
 */
interface Props {
  text: string;
  label?: string;
  tail?: number;
  className?: string;
  maxHeight?: string;
}

export function StreamConsole({ text, label = "live output", tail = 480, className = "", maxHeight = "9rem" }: Props) {
  if (!text) return null;
  return (
    <div
      className={`relative rounded-xl overflow-hidden ${className}`}
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="status-dot" data-pulse="true" style={{ color: "var(--accent)", width: 6, height: 6 }} />
        <span className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <div
        className="px-3 py-2.5 overflow-hidden text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words flex flex-col justify-end"
        style={{ color: "var(--text-muted)", maxHeight }}
      >
        <p>
          {text.slice(-tail)}
          <span className="caret" />
        </p>
      </div>
      {/* Fade the top edge so the tail reads as scrolling past. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[33px] h-8"
        style={{ background: "linear-gradient(var(--bg-elevated), transparent)" }}
      />
    </div>
  );
}
