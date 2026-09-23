/** Small presentational pieces shared by the results blocks. */

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] mb-3" style={{ color: "var(--text-muted)" }}>
      {children}
    </h3>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[13px] leading-relaxed rounded-xl border border-dashed px-4 py-3.5"
      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
    >
      {children}
    </p>
  );
}
