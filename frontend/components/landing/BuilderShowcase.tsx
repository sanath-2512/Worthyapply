"use client";

import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../motion/Reveal";
import { ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";

/** Resume builder showcase — layered mock with depth parallax on scroll. */
export function BuilderShowcase() {
  const ref = useRef<HTMLElement>(null);

  useGsap(
    ({ reduced, scope }) => {
      if (reduced) return;
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        gsap.utils.toArray<HTMLElement>("[data-depth]", scope).forEach((el) => {
          const d = Number(el.dataset.depth || 0);
          gsap.fromTo(
            el,
            { yPercent: d * 12 },
            { yPercent: -d * 12, ease: "none", scrollTrigger: { trigger: scope, start: "top bottom", end: "bottom top", scrub: true } }
          );
        });
      });
      return () => mm.revert();
    },
    [],
    ref
  );

  return (
    <section ref={ref} aria-labelledby="builder-title" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="container-x grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
        <Reveal>
          <SectionHeading
            id="builder-title"
            eyebrow="No resume yet? Start here"
            size="lg"
            title="A full resume builder, from a blank page to a clean PDF."
            sub="Build section by section in a live editor — experience, skills, projects, education — and export a polished one-page PDF. Or import an existing file, then let the analyzer tailor it to a specific job."
          />
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <ButtonLink href="/builder" variant="secondary" size="lg" iconLeft="pencil" iconRight="arrow-right">
              Open the resume builder
            </ButtonLink>
          </div>
        </Reveal>

        <div className="relative h-[420px] sm:h-[480px]" aria-hidden="true">
          {/* Back layer: editor panel */}
          <div data-depth="0.4" className="absolute left-0 top-6 w-[78%] card-elevated p-5 space-y-3">
            <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>Editor</p>
            {["Personal details", "Experience", "Projects", "Skills"].map((s, i) => (
              <div key={s} className="rounded-xl p-3.5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>{s}</span>
                  <span style={{ color: i < 3 ? "var(--green)" : "var(--text-muted)" }}><Icon name={i < 3 ? "check" : "chevron-down"} size={13} /></span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full rounded-full" style={{ background: "var(--surface-elevated)" }} />
                  <div className="h-1.5 w-3/4 rounded-full" style={{ background: "var(--surface-elevated)" }} />
                </div>
              </div>
            ))}
          </div>
          {/* Front layer: A4 preview */}
          <div
            data-depth="-0.6"
            className="absolute right-0 bottom-0 w-[58%] rounded-lg p-4 sm:p-5 space-y-3"
            style={{ background: "#fff", boxShadow: "var(--shadow-pop)", aspectRatio: "210 / 297" }}
          >
            <div className="h-3 w-2/3 rounded" style={{ background: "#111" }} />
            <div className="h-1.5 w-5/6 rounded" style={{ background: "#d4d4dc" }} />
            <div className="h-px" style={{ background: "#e4e4ea" }} />
            {[0, 1, 2].map((k) => (
              <div key={k} className="space-y-1.5">
                <div className="h-2 w-1/3 rounded" style={{ background: "#444" }} />
                <div className="h-1.5 w-full rounded" style={{ background: "#e4e4ea" }} />
                <div className="h-1.5 w-11/12 rounded" style={{ background: "#e4e4ea" }} />
                <div className="h-1.5 w-4/5 rounded" style={{ background: "#e4e4ea" }} />
              </div>
            ))}
          </div>
          {/* Floating chip */}
          <div data-depth="-1.2" className="absolute right-[8%] top-[2%] glass rounded-xl px-3 py-2 flex items-center gap-2" style={{ boxShadow: "var(--shadow-pop)" }}>
            <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "var(--accent)", color: "#fff" }}>
              <Icon name="download" size={12} />
            </span>
            <span className="text-[12px] font-medium" style={{ color: "var(--text)" }}>One page · ready</span>
          </div>
        </div>
      </div>
    </section>
  );
}
