import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../motion/Reveal";
import { Spotlight } from "../motion/Spotlight";
import { Icon, type IconName } from "../ui/Icon";

function FeatureCard({
  icon,
  title,
  body,
  className = "",
  children,
}: {
  icon: IconName;
  title: string;
  body: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div data-reveal className={className}>
      <Spotlight className="card interactive-card h-full p-6 sm:p-7 flex flex-col overflow-hidden">
        <span
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-5"
          style={{ background: "var(--surface-elevated)", color: "var(--accent-bright)", border: "1px solid var(--border-subtle)" }}
        >
          <Icon name={icon} size={18} />
        </span>
        <h3 className="text-[16px] font-semibold tracking-[-0.015em]" style={{ color: "var(--text)" }}>{title}</h3>
        <p className="text-[13.5px] leading-relaxed mt-2" style={{ color: "var(--text-secondary)" }}>{body}</p>
        {children && <div className="mt-auto pt-6">{children}</div>}
      </Spotlight>
    </div>
  );
}

const BARS = [
  { label: "Required skills", v: 0.8, c: "var(--green)" },
  { label: "Experience", v: 0.66, c: "var(--green)" },
  { label: "Preferred", v: 0.4, c: "var(--amber)" },
  { label: "Education", v: 1, c: "var(--green)" },
];

export function FeatureGrid() {
  return (
    <section id="features" aria-labelledby="features-title" className="relative py-24 sm:py-32">
      <div className="container-x">
        <Reveal>
          <SectionHeading
            id="features-title"
            eyebrow="Everything in the loop"
            size="lg"
            title="From a job you're unsure about to a resume that fits it."
            sub="WorthyApply covers the whole application loop — and builds a resume from scratch if you don't have one yet."
          />
        </Reveal>

        <Reveal stagger={0.08} className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <FeatureCard
            className="lg:col-span-4"
            icon="search"
            title="Honest fit analysis"
            body="Every requirement checked against real evidence — matched, partial, or missing. Weighted into a score you can actually read the reasoning behind."
          >
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3.5">
              {BARS.map((b) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span style={{ color: "var(--text-secondary)" }}>{b.label}</span>
                    <span className="font-mono tabular" style={{ color: b.c }}>{Math.round(b.v * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-elevated)" }}>
                    <div className="h-full rounded-full" style={{ width: `${b.v * 100}%`, background: b.c }} />
                  </div>
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard
            className="lg:col-span-2"
            icon="sparkle"
            title="Automatic tailoring"
            body="The instant analysis ends, your bullets are rewritten for the job using only what you've actually done."
          />
          <FeatureCard
            className="lg:col-span-2"
            icon="pencil"
            title="Full resume editor"
            body="Tailored or imported, it opens in a live editor with a true A4 preview. Change anything before you export."
          />
          <FeatureCard
            className="lg:col-span-2"
            icon="file-plus"
            title="Build from scratch"
            body="No resume yet? Start blank, add sections, and export a polished one-page PDF — or import an existing file."
          />
          <FeatureCard
            className="md:col-span-2 lg:col-span-2"
            icon="copy"
            title="Application brief"
            body="A one-glance summary of role, score, strongest match and biggest gap — copy it straight into your notes."
          />
        </Reveal>
      </div>
    </section>
  );
}
