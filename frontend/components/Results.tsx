"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AnalysisResponse } from "@/lib/types";
import { gsap, useGsap } from "@/lib/motion";
import { OverviewHero } from "./results/OverviewHero";
import { SkillConstellation } from "./results/SkillConstellation";
import { RequirementsBlock } from "./results/RequirementsBlock";
import { MatchBlock } from "./results/MatchBlock";
import { ImprovementsBlock } from "./results/ImprovementsBlock";
import { DetailsBlock } from "./results/DetailsBlock";
import { ApplicationBrief } from "./results/ApplicationBrief";
import { TailoredResumeAction } from "./results/TailoredResumeAction";
import { Reveal } from "./motion/Reveal";
import { BackButton } from "./ui/BackButton";
import { ThemeToggle } from "./ui/ThemeToggle";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { useSmoothScroll } from "./providers/SmoothScroll";

interface Props {
  data: AnalysisResponse;
  onReset: () => void;
  onBack?: () => void;
  resumeFile?: File | null;
  jobDescription?: string;
}

const nav = [
  { id: "overview", label: "Overview" },
  { id: "requirements", label: "Role" },
  { id: "match", label: "Your Fit" },
  { id: "improvements", label: "Optimization" },
  { id: "tailor", label: "Tailor Resume" },
  { id: "brief", label: "Brief" },
];

export function Results({ data, onReset, onBack, resumeFile = null, jobDescription = "" }: Props) {
  const [active, setActive] = useState("overview");
  const obsRef = useRef<IntersectionObserver | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileTabsRef = useRef<HTMLDivElement>(null);
  const { scrollTo: smoothScrollTo } = useSmoothScroll();

  useEffect(() => {
    const els = nav.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    obsRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: "-25% 0px -55% 0px" }
    );
    els.forEach((el) => obsRef.current?.observe(el));
    return () => obsRef.current?.disconnect();
  }, []);

  // Keep the active mobile tab visible in its scroll strip.
  useEffect(() => {
    const strip = mobileTabsRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (strip && tab) {
      strip.scrollTo({ left: tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2, behavior: "smooth" });
    }
  }, [active]);

  // Reading progress along the top edge of the header.
  useGsap(
    ({ reduced, scope }) => {
      const bar = scope.querySelector("[data-progress]");
      if (!bar) return;
      gsap.fromTo(
        bar,
        { scaleX: 0 },
        { scaleX: 1, ease: "none", scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: reduced ? true : 0.3 } }
      );
    },
    [],
    headerRef
  );

  const scrollTo = (id: string) => {
    // Clear the sticky header (and the mobile tab row) when jumping to a section.
    const offset = -((headerRef.current?.offsetHeight ?? 64) + 12);
    smoothScrollTo(id, { offset });
  };

  const { job_analysis: ja, match_analysis: ma } = data;

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-x-0 top-0 h-[640px] grid-bg opacity-50 pointer-events-none" aria-hidden="true" />

      {/* Sticky header */}
      <div
        ref={headerRef}
        className="sticky top-0 z-50 border-b print:hidden"
        style={{
          background: "var(--nav-bg)",
          borderColor: "var(--border-subtle)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
        }}
      >
        <nav aria-label="Results" className="max-w-[1200px] mx-auto px-[var(--gutter)] h-[var(--header-h)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {onBack && <BackButton label="Back" onFallback={onBack} />}
            <span className="hidden sm:block w-px h-5 mx-1" style={{ background: "var(--border)" }} aria-hidden="true" />
            <span className="hidden sm:inline-flex"><Logo size={26} showWordmark={false} /></span>
            <span className="hidden md:inline lg:hidden xl:inline text-[13px] truncate max-w-[200px] xl:max-w-[220px] ml-1" style={{ color: "var(--text-secondary)" }} title={ja.job_title}>
              {ja.job_title}
            </span>
          </div>

          {/* Desktop section tabs */}
          <div className="hidden lg:flex items-center gap-0.5 p-1 rounded-xl" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)" }}>
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                aria-current={active === n.id ? "true" : undefined}
                className="relative px-3 h-8 text-[12.5px] font-medium rounded-lg transition-colors duration-200 whitespace-nowrap"
                style={{ color: active === n.id ? "var(--text)" : "var(--text-muted)" }}
              >
                {active === n.id && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative z-10">{n.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" iconLeft="refresh" onClick={onReset} aria-label="Start a new analysis">
              <span className="hidden sm:inline">New</span>
            </Button>
            <ThemeToggle />
            <Button size="sm" iconLeft="sparkle" onClick={() => scrollTo("tailor")}>
              <span className="hidden sm:inline">Tailor Resume</span>
              <span className="sm:hidden">Tailor</span>
            </Button>
          </div>
        </nav>

        {/* Mobile section tabs */}
        <div
          ref={mobileTabsRef}
          className="lg:hidden overflow-x-auto no-scrollbar fade-x"
          role="navigation"
          aria-label="Jump to section"
        >
          <div className="flex items-center gap-1 px-[var(--gutter)] pb-2.5 w-max">
            {nav.map((n) => (
              <button
                key={n.id}
                data-tab={n.id}
                onClick={() => scrollTo(n.id)}
                aria-current={active === n.id ? "true" : undefined}
                className="relative h-8 px-3 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors"
                style={{ color: active === n.id ? "var(--text)" : "var(--text-muted)" }}
              >
                {active === n.id && (
                  <motion.span
                    layoutId="activeNavMobile"
                    className="absolute inset-0 rounded-full"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative z-10">{n.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="absolute left-0 right-0 -bottom-px h-px overflow-hidden" aria-hidden="true">
          <div data-progress className="h-full origin-left" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))", transform: "scaleX(0)" }} />
        </div>
      </div>

      {/* Sections */}
      <main id="main" tabIndex={-1} className="relative max-w-[1040px] mx-auto px-[var(--gutter)] outline-none">
        {/* Overview */}
        <section id="overview" className="pt-12 sm:pt-16 pb-20 sm:pb-28" aria-label="Overview">
          <OverviewHero
            jobTitle={ja.job_title}
            company={ja.company}
            experience={ja.experience_required}
            score={ma.match_score}
            recommendation={ma.recommendation}
            reason={ma.recommendation_reason}
            matched={ma.matching_skills.length}
            gaps={ma.skill_gaps.length}
            total={ma.required_skills.length}
            onScrollToTailor={() => scrollTo("tailor")}
          />
        </section>

        {/* Skill Constellation */}
        <section className="pb-20 sm:pb-28" aria-label="Skill map">
          <Reveal>
            <SkillConstellation
              matching={ma.matching_skills}
              gaps={ma.skill_gaps}
              niceToHave={ja.nice_to_have}
            />
          </Reveal>
        </section>

        {/* Requirements */}
        <section id="requirements" className="pb-20 sm:pb-28" aria-label="Role requirements">
          <Reveal>
            <RequirementsBlock
              technical={ja.technical_skills}
              soft={ja.soft_skills}
              responsibilities={ja.responsibilities}
              keywords={ja.keywords}
              niceToHave={ja.nice_to_have}
            />
          </Reveal>
        </section>

        {/* Match */}
        <section id="match" className="pb-20 sm:pb-28" aria-label="Your fit">
          <Reveal>
            <MatchBlock
              required={ma.required_skills}
              matching={ma.matching_skills}
              gaps={ma.skill_gaps}
            />
          </Reveal>
        </section>

        {/* Improvements */}
        <section id="improvements" className="pb-20 sm:pb-28" aria-label="Optimization">
          <Reveal>
            <ImprovementsBlock
              assessment={data.resume_optimization.overall_assessment}
              priorities={data.resume_optimization.priority_improvements}
              bullets={data.resume_optimization.resume_bullet_improvements}
              keywords={data.resume_optimization.keywords_to_include}
              onScrollToTailor={() => scrollTo("tailor")}
            />
          </Reveal>
        </section>

        {/* Tailored Resume (Action & Live Workbench) */}
        <section id="tailor" className="pb-20 sm:pb-28" aria-label="Tailor resume">
          <Reveal>
            <TailoredResumeAction
              data={data}
              resumeFile={resumeFile}
              jobDescription={jobDescription}
            />
          </Reveal>
        </section>

        {/* Details (expandable) */}
        <section className="pb-20 sm:pb-28" aria-label="Full details">
          <Reveal>
            <DetailsBlock
              summary={ja.summary}
              missing={data.resume_optimization.missing_or_weak_requirements}
              warnings={data.resume_optimization.warnings}
            />
          </Reveal>
        </section>

        {/* Application Brief */}
        <section id="brief" className="pb-28 sm:pb-36" aria-label="Application brief">
          <Reveal>
            <ApplicationBrief data={data} />
          </Reveal>
        </section>
      </main>
    </div>
  );
}
