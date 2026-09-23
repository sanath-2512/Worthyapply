"use client";

import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";
import { SignalScene } from "../three/SignalScene";
import { createDriver, type SceneDriver } from "../three/driver";
import { SplitHeading } from "../motion/SplitHeading";
import { Button, ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";

export function Hero({ onGetStarted }: { onGetStarted: () => void }) {
  const sectionRef = useRef<HTMLElement>(null);
  const driver = useRef<SceneDriver>(createDriver());

  useGsap(
    ({ reduced, scope }) => {
      // Two inputs feed the form: the intro (noise settling toward order) and
      // scroll (fully resolving as the hero leaves). Combined, not competing.
      const mix = { intro: 0, scroll: 0 };
      const apply = () => {
        driver.current.progress = Math.min(1, mix.intro * 0.62 + mix.scroll * 0.38);
      };

      if (reduced) {
        mix.intro = 1;
        mix.scroll = 1;
        apply();
        return;
      }

      gsap.to(mix, { intro: 1, duration: 3.2, delay: 0.3, ease: "power2.inOut", onUpdate: apply });

      gsap.from(scope.querySelectorAll("[data-hero-fade]"), {
        y: 18,
        autoAlpha: 0,
        duration: 1.1,
        stagger: 0.08,
        delay: 0.45,
        ease: "expo.out",
      });

      gsap.from(scope.querySelectorAll("[data-hero-chip]"), {
        scale: 0.85,
        autoAlpha: 0,
        y: 12,
        duration: 1,
        stagger: 0.18,
        delay: 1.6,
        ease: "back.out(1.6)",
      });

      // Scroll-out: content lifts and fades while the form completes.
      const tl = gsap.timeline({
        scrollTrigger: { trigger: scope, start: "top top", end: "bottom top", scrub: 0.6 },
      });
      tl.to(mix, { scroll: 1, ease: "none", onUpdate: apply }, 0)
        .to(scope.querySelector("[data-hero-content]"), { yPercent: -18, autoAlpha: 0, ease: "none" }, 0)
        .to(scope.querySelector("[data-hero-scene]"), { scale: 1.12, yPercent: 8, ease: "none" }, 0)
        .to(scope.querySelectorAll("[data-hero-chip]"), { y: -60, autoAlpha: 0, stagger: 0.05, ease: "none" }, 0);
    },
    [],
    sectionRef
  );

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100svh] flex flex-col overflow-hidden"
      aria-labelledby="hero-title"
    >
      {/* Atmosphere */}
      <div className="absolute inset-0 grid-bg opacity-70" aria-hidden="true" />
      <div data-hero-scene className="absolute inset-0 will-change-transform">
        <SignalScene driver={driver} className="absolute inset-0" offsetX={2.7} />
      </div>
      {/* Legibility scrim: stronger on phones where text overlays the form. */}
      <div
        className="absolute inset-0 pointer-events-none lg:hidden"
        aria-hidden="true"
        style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 35%, transparent) 0%, color-mix(in srgb, var(--bg) 70%, transparent) 55%, var(--bg) 100%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none hidden lg:block"
        aria-hidden="true"
        style={{ background: "linear-gradient(90deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 70%, transparent) 38%, transparent 62%), linear-gradient(0deg, var(--bg) 0%, transparent 22%)" }}
      />

      {/* Floating readouts around the form — what the analysis actually reports. */}
      <div className="absolute inset-0 pointer-events-none hidden lg:block" aria-hidden="true">
        <div className="container-x relative h-full">
          <div data-hero-chip className="absolute right-[6%] top-[24%] glass rounded-xl px-3.5 py-2.5 flex items-center gap-2.5" style={{ boxShadow: "var(--shadow-pop)" }}>
            <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
              <Icon name="check" size={13} strokeWidth={2.5} />
            </span>
            <span className="text-[12.5px] font-medium" style={{ color: "var(--text)" }}>React</span>
            <span className="text-[11px] font-mono" style={{ color: "var(--green)" }}>matched</span>
          </div>
          <div data-hero-chip className="absolute right-[30%] bottom-[24%] glass rounded-xl px-3.5 py-2.5 flex items-center gap-2.5" style={{ boxShadow: "var(--shadow-pop)" }}>
            <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>
              <Icon name="alert" size={13} />
            </span>
            <span className="text-[12.5px] font-medium" style={{ color: "var(--text)" }}>Kubernetes</span>
            <span className="text-[11px] font-mono" style={{ color: "var(--amber)" }}>gap · flagged</span>
          </div>
          <div data-hero-chip className="absolute right-[2%] bottom-[36%] glass rounded-2xl px-4 py-3" style={{ boxShadow: "var(--shadow-pop)" }}>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Fit score</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[13px] font-mono line-through" style={{ color: "var(--text-muted)" }}>62</span>
              <Icon name="arrow-right" size={12} style={{ color: "var(--text-muted)" }} />
              <span className="text-2xl font-semibold tabular tracking-tight" style={{ color: "var(--green)" }}>88</span>
            </p>
          </div>
        </div>
      </div>

      <div data-hero-content className="relative z-10 flex-1 flex items-center pt-[calc(var(--header-h)+40px)] pb-24 lg:pb-16">
        <div className="container-x">
          <div className="max-w-[640px]">
            <p data-hero-fade className="mb-7">
              <span
                className="inline-flex items-center gap-2 text-[12.5px] font-medium pl-2 pr-3 py-1.5 rounded-full glass"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="status-dot" data-pulse="true" style={{ color: "var(--green)", width: 6, height: 6 }} />
                Reads your resume, not the job board hype
              </span>
            </p>

            <SplitHeading as="h1" id="hero-title" trigger="mount" delay={0.15} className="display-xl" style={{ color: "var(--text)" }}>
              Stop applying blind. See if you <span className="serif-accent" style={{ color: "var(--accent-bright)" }}>actually fit</span>.
            </SplitHeading>

            <p data-hero-fade className="lead mt-7 max-w-[520px]">
              Paste a job, drop in your resume, and see exactly where you match. Then WorthyApply{" "}
              <span className="font-medium" style={{ color: "var(--text)" }}>tailors it to the job</span> — using only
              what you&apos;ve actually done.
            </p>

            <div data-hero-fade className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button size="lg" magnetic onClick={onGetStarted} iconRight="arrow-right">
                Check my fit
              </Button>
              <ButtonLink href="/builder" variant="secondary" size="lg" iconLeft="pencil">
                Build a resume instead
              </ButtonLink>
            </div>

            <ul data-hero-fade className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              {["No account", "PDF in, PDF out", "Nothing invented"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Icon name="check" size={13} style={{ color: "var(--accent-bright)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div data-hero-fade className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 hidden sm:flex flex-col items-center gap-2" aria-hidden="true">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
          Scroll
        </span>
        <span className="relative block w-px h-10 overflow-hidden" style={{ background: "var(--border)" }}>
          <span className="absolute inset-x-0 top-0 h-1/2 animate-[scrollcue_2.2s_cubic-bezier(0.65,0,0.35,1)_infinite]" style={{ background: "var(--accent-bright)" }} />
        </span>
      </div>
    </section>
  );
}
