"use client";

/**
 * The headline feature: automatic tailoring. The visual is a live rewrite —
 * the weak line is struck through word by word, the grounded rewrite types
 * in, and the gap note lands last. Scroll-triggered once; static for reduced
 * motion.
 */
import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";
import { SectionHeading } from "../ui/SectionHeading";
import { Reveal } from "../motion/Reveal";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

const BEFORE = "Built a website using React and APIs.";
const AFTER = "Developed a React application integrating REST APIs for dynamic data retrieval.";

const POINTS = [
  "Every rewrite is grounded in your real experience — nothing fabricated.",
  "Weak, vague lines become specific, measurable ones aimed at the role.",
  "Missing requirements stay flagged as gaps instead of being faked.",
  "The tailored version opens in the editor so you always have the final say.",
];

export function TailorFeature({ onGetStarted }: { onGetStarted: () => void }) {
  const ref = useRef<HTMLElement>(null);

  useGsap(
    ({ reduced, scope }) => {
      if (reduced) return;
      const demo = scope.querySelector("[data-demo]");
      const strike = scope.querySelectorAll("[data-strike]");
      const afterWords = scope.querySelectorAll("[data-after] > span");
      const tail = scope.querySelectorAll("[data-tail]");
      gsap.set(strike, { "--strike": 0 });
      gsap.set(afterWords, { autoAlpha: 0, y: 6 });
      gsap.set(tail, { autoAlpha: 0, y: 10 });

      const tl = gsap.timeline({ scrollTrigger: { trigger: demo, start: "top 72%", once: true } });
      tl.to(strike, { "--strike": 1, duration: 0.28, stagger: 0.04, ease: "power2.out" })
        .to(scope.querySelector("[data-before]"), { opacity: 0.55, duration: 0.3 }, "<0.15")
        .to(afterWords, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.03, ease: "expo.out" }, "-=0.1")
        .to(tail, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.12, ease: "expo.out" }, "-=0.35");
    },
    [],
    ref
  );

  return (
    <section ref={ref} id="tailoring" aria-labelledby="tailoring-title" className="relative py-24 sm:py-32">
      <div className="container-x grid lg:grid-cols-[1fr_1.05fr] gap-14 lg:gap-20 items-center">
        <div>
          <Reveal>
            <SectionHeading
              id="tailoring-title"
              eyebrow="The core feature"
              size="lg"
              title={
                <>
                  It tailors your resume <span className="serif-accent" style={{ color: "var(--accent-bright)" }}>automatically</span>.
                </>
              }
              sub="No second button, no copying suggestions by hand. The moment WorthyApply finishes scoring your fit, it rewrites the lines that matter for that job and hands you a tailored resume — ready to review, edit and download."
            />
          </Reveal>
          <Reveal stagger={0.07} as="ul" className="mt-9 space-y-3.5">
            {POINTS.map((t) => (
              <li key={t} data-reveal className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
                  <Icon name="check" size={12} strokeWidth={2.5} />
                </span>
                <span className="text-[14.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t}</span>
              </li>
            ))}
          </Reveal>
          <Reveal className="mt-10">
            <Button magnetic onClick={onGetStarted} iconRight="arrow-right">
              See it tailor my resume
            </Button>
          </Reveal>
        </div>

        <Reveal>
          <div data-demo className="card-elevated p-5 sm:p-7 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-60" style={{ background: "var(--accent-dim)" }} aria-hidden="true" />
            <div className="relative flex items-center justify-between gap-3 mb-6">
              <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>frontend-engineer.jd</span>
              <span className="text-[12px] font-medium tabular" style={{ color: "var(--text-secondary)" }}>
                Fit 62 <span style={{ color: "var(--text-muted)" }}>→</span> <span style={{ color: "var(--green)" }}>88</span>
              </span>
            </div>

            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Your line</p>
            <p data-before className="relative mt-2 text-[14px] leading-relaxed rounded-xl px-4 py-3" style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}>
              {BEFORE.split(" ").map((w, i) => (
                <span key={i} data-strike className="relative inline-block mr-[0.28em] strike-word">
                  {w}
                </span>
              ))}
            </p>

            <div className="flex items-center gap-2 my-4 pl-1" aria-hidden="true">
              <span style={{ color: "var(--accent-bright)" }}><Icon name="sparkle" size={14} /></span>
              <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Same facts, sharper — aimed at this role</span>
            </div>

            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: "var(--green)" }}>Tailored automatically</p>
            <p data-after className="mt-2 text-[14px] leading-relaxed rounded-xl px-4 py-3" style={{ background: "var(--green-dim)", color: "var(--text)", border: "1px solid var(--green-glow)" }}>
              {AFTER.split(" ").map((w, i) => (
                <span key={i} className="inline-block mr-[0.28em]">{w}</span>
              ))}
            </p>

            <div data-tail className="mt-5 flex items-start gap-2.5 p-3.5 rounded-xl" style={{ background: "var(--amber-dim)" }}>
              <span className="mt-0.5 shrink-0" style={{ color: "var(--amber)" }}><Icon name="alert" size={14} /></span>
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                The job wants Kubernetes and your resume doesn&apos;t show it — so it stays a flagged gap. We{" "}
                <span className="font-semibold" style={{ color: "var(--text)" }}>never</span> pretend you have it.
              </p>
            </div>
            <div data-tail className="mt-4 flex flex-wrap gap-2">
              {["React", "REST APIs", "TypeScript"].map((k) => (
                <span key={k} className="chip chip-match"><Icon name="check" size={11} strokeWidth={2.5} />{k}</span>
              ))}
              <span className="chip chip-gap"><Icon name="x" size={11} strokeWidth={2.5} />Kubernetes</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
