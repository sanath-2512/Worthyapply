"use client";

/**
 * "How it works" — the product story in three beats.
 *
 * Desktop (≥1024px, motion allowed): the section pins and scroll scrubs
 * through the steps; the active step's copy lights up and its vignette
 * cross-fades in with its internals animating. Everywhere else it is a plain
 * stacked sequence with scroll reveals — no pinning on touch devices.
 */
import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../motion/Reveal";
import { InputsVisual, ScoreVisual, EditorVisual } from "./StepVisuals";

const STEPS = [
  {
    n: "01",
    title: "You paste the job and your resume",
    body: "Drop in a job description and your resume PDF. That's the only manual step — the rest runs on its own.",
    Visual: InputsVisual,
  },
  {
    n: "02",
    title: "It scores every requirement — with evidence",
    body: "Each requirement is checked against what your resume actually shows: matched, partial or missing. An explainable score, not a black box.",
    Visual: ScoreVisual,
  },
  {
    n: "03",
    title: "It tailors, you edit and export",
    body: "Your resume is rewritten for the role and opens in a full editor. Adjust anything, then download a clean one-page PDF.",
    Visual: EditorVisual,
  },
];

const RING_C = 2 * Math.PI * 34;

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);

  useGsap(
    ({ reduced, scope }) => {
      if (reduced) return;
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const pin = scope.querySelector<HTMLElement>("[data-pin]");
        const items = gsap.utils.toArray<HTMLElement>("[data-step]", scope);
        const panels = gsap.utils.toArray<HTMLElement>("[data-panel]", scope);
        const bars = gsap.utils.toArray<HTMLElement>("[data-step-bar]", scope);
        if (!pin || panels.length !== 3) return;

        gsap.set(panels.slice(1), { autoAlpha: 0, y: 40, scale: 0.97 });
        gsap.set(items.slice(1), { opacity: 0.35 });
        gsap.set(bars, { scaleY: 0, transformOrigin: "top" });

        const arc = panels[1].querySelector<SVGCircleElement>("[data-demo-arc]");
        const score = panels[1].querySelector<HTMLElement>("[data-demo-score]");
        const scoreState = { v: 0 };
        if (arc) gsap.set(arc, { strokeDashoffset: RING_C });
        if (score) score.textContent = "0";

        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            trigger: pin,
            start: "top top",
            end: "+=220%",
            pin: true,
            scrub: 0.8,
            snap: { snapTo: [0, 0.5, 1], duration: { min: 0.2, max: 0.6 }, ease: "power2.inOut" },
            anticipatePin: 1,
          },
        });

        // Step 1 is already on screen when the pin starts, so its internals
        // reveal on arrival rather than on the scrub (which would start them hidden).
        gsap.from(panels[0].querySelectorAll("[data-step-item]"), {
          y: 14,
          autoAlpha: 0,
          stagger: 0.12,
          duration: 0.8,
          ease: "expo.out",
          scrollTrigger: { trigger: pin, start: "top 65%", once: true },
        });

        // Step 1 progress bar fills while its panel is on screen.
        tl.to(bars[0], { scaleY: 1, duration: 1 }, 0);

        // → Step 2
        tl.to(panels[0], { autoAlpha: 0, y: -40, scale: 0.97, duration: 0.5 }, 1)
          .to(items[0], { opacity: 0.35, duration: 0.4 }, 1)
          .to(items[1], { opacity: 1, duration: 0.4 }, 1)
          .to(panels[1], { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 }, 1.1)
          .to(bars[1], { scaleY: 1, duration: 1 }, 1.1)
          .to(scoreState, {
            v: 74,
            duration: 0.8,
            onUpdate: () => {
              if (score) score.textContent = String(Math.round(scoreState.v));
              if (arc) arc.style.strokeDashoffset = String(RING_C * (1 - scoreState.v / 100));
            },
          }, 1.2)
          .from(panels[1].querySelectorAll("[data-step-item]"), { x: -16, autoAlpha: 0, stagger: 0.12, duration: 0.4 }, 1.3);

        // → Step 3
        tl.to(panels[1], { autoAlpha: 0, y: -40, scale: 0.97, duration: 0.5 }, 2.2)
          .to(items[1], { opacity: 0.35, duration: 0.4 }, 2.2)
          .to(items[2], { opacity: 1, duration: 0.4 }, 2.2)
          .to(panels[2], { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 }, 2.3)
          .to(bars[2], { scaleY: 1, duration: 0.9 }, 2.3)
          .from(panels[2].querySelectorAll("[data-step-item]"), { scale: 0.96, autoAlpha: 0, stagger: 0.2, duration: 0.45 }, 2.5);
      });
      return () => mm.revert();
    },
    [],
    ref
  );

  return (
    <section ref={ref} id="how" aria-labelledby="how-title" className="relative">
      {/* Desktop: pinned stage */}
      <div data-pin className="hidden lg:flex min-h-[100svh] items-center py-24">
        <div className="container-x grid grid-cols-[0.9fr_1.1fr] gap-16 xl:gap-24 items-center">
          <div>
            <SectionHeading
              id="how-title"
              eyebrow="How it works"
              size="lg"
              title={
                <>
                  Three steps. <span className="serif-accent" style={{ color: "var(--accent-bright)" }}>One</span> is on you.
                </>
              }
            />
            <ol className="mt-12 space-y-8">
              {STEPS.map((s) => (
                <li key={s.n} data-step className="relative pl-8">
                  <span className="absolute left-0 top-1 bottom-1 w-px" style={{ background: "var(--border)" }} aria-hidden="true">
                    <span data-step-bar className="absolute inset-0" style={{ background: "var(--accent-bright)" }} />
                  </span>
                  <span className="text-[12px] font-mono" style={{ color: "var(--accent-bright)" }}>{s.n}</span>
                  <h3 className="text-[19px] font-semibold tracking-[-0.02em] mt-1" style={{ color: "var(--text)" }}>{s.title}</h3>
                  <p className="text-[14.5px] leading-relaxed mt-2 max-w-md" style={{ color: "var(--text-secondary)" }}>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative h-[560px] flex items-center">
            <div className="absolute inset-0 -z-10 rounded-[40px] opacity-70" style={{ background: "radial-gradient(60% 60% at 50% 50%, var(--accent-dim), transparent 70%)" }} aria-hidden="true" />
            {STEPS.map(({ n, Visual }) => (
              <div key={n} data-panel className="absolute inset-x-0 top-1/2 -translate-y-1/2 max-w-[520px] mx-auto w-full">
                <Visual />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tablet & mobile: stacked */}
      <div className="lg:hidden py-24">
        <div className="container-x">
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              size="lg"
              title={
                <>
                  Three steps. <span className="serif-accent" style={{ color: "var(--accent-bright)" }}>One</span> is on you.
                </>
              }
            />
          </Reveal>
          <ol className="mt-12 space-y-16">
            {STEPS.map(({ n, title, body, Visual }) => (
              <li key={n}>
                <Reveal>
                  <span className="text-[12px] font-mono" style={{ color: "var(--accent-bright)" }}>{n}</span>
                  <h3 className="text-[19px] font-semibold tracking-[-0.02em] mt-1" style={{ color: "var(--text)" }}>{title}</h3>
                  <p className="text-[14.5px] leading-relaxed mt-2 mb-6 max-w-lg" style={{ color: "var(--text-secondary)" }}>{body}</p>
                  <div className="max-w-[560px]">
                    <Visual />
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
