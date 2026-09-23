import { CountUp } from "../motion/CountUp";
import { Reveal } from "../motion/Reveal";

/**
 * Facts about how the product works — each one true of the actual pipeline,
 * not marketing vanity metrics.
 */
const FACTS = [
  { value: 3, suffix: "", label: "analysis phases", sub: "role · match · rewrite, in one pass" },
  { value: 40, prefix: "15–", suffix: "s", label: "typical analysis", sub: "streamed live while it runs" },
  { value: 0, suffix: "", label: "invented claims", sub: "gaps are flagged, never faked" },
  { value: 1, suffix: "", label: "page PDF export", sub: "clean, selectable, ATS-readable" },
];

export function ProofStrip() {
  return (
    <section aria-label="What to expect" className="relative border-y" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
      <Reveal stagger={0.08} className="container-x grid grid-cols-2 lg:grid-cols-4">
        {FACTS.map((f, i) => (
          <div
            key={f.label}
            data-reveal
            className={`py-8 sm:py-10 px-2 sm:px-6 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <p className="text-[clamp(2rem,4vw,2.75rem)] font-semibold tracking-[-0.04em] leading-none" style={{ color: "var(--text)" }}>
              <CountUp value={f.value} prefix={f.prefix} suffix={f.suffix} />
            </p>
            <p className="mt-3 text-[13.5px] font-medium" style={{ color: "var(--text)" }}>{f.label}</p>
            <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>{f.sub}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
