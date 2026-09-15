"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AnalysisResponse } from "@/lib/types";
import { OverviewHero } from "./results/OverviewHero";
import { SkillConstellation } from "./results/SkillConstellation";
import { RequirementsBlock } from "./results/RequirementsBlock";
import { MatchBlock } from "./results/MatchBlock";
import { ImprovementsBlock } from "./results/ImprovementsBlock";
import { DetailsBlock } from "./results/DetailsBlock";
import { ApplicationBrief } from "./results/ApplicationBrief";
import { TailoredResumeAction } from "./results/TailoredResumeAction";
import { Reveal } from "./results/Reveal";
import { Icon } from "./ui/Icon";
import { BackButton } from "./ui/BackButton";
import { ThemeToggle } from "./ui/ThemeToggle";

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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen relative">
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-[150px] opacity-[0.03] pointer-events-none"
        style={{ background: "var(--accent)" }}
      />

      {/* Sticky nav */}
      <nav
        className="sticky top-0 z-50 border-b backdrop-blur-2xl"
        style={{ background: "var(--nav-bg)", borderColor: "var(--border-subtle)" }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            {onBack && <BackButton label="Back" onFallback={onBack} className="!text-[11px]" />}
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text)" }}>
              WorthyApply
            </span>
            <button
              onClick={onReset}
              className="text-[10px] font-medium transition-opacity hover:opacity-60"
              style={{ color: "var(--text-muted)" }}
              aria-label="Start a new analysis"
            >
              <span className="inline-flex items-center gap-1"><Icon name="refresh" size={12} /> New</span>
            </button>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5 p-1 rounded-xl" style={{ background: "var(--surface)" }}>
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className="relative px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all duration-200"
                style={{ color: active === n.id ? "var(--text)" : "var(--text-muted)" }}
              >
                {active === n.id && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{n.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Tailor CTA + Theme + Mobile Nav */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <button
              onClick={() => scrollTo("tailor")}
              className="magnetic-btn px-3.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all duration-200 hover:brightness-110 active:scale-95"
              style={{
                background: "var(--accent)",
                color: "#fff",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              <Icon name="sparkle" size={13} />
              <span className="hidden sm:inline">Tailor Resume</span>
              <span className="sm:hidden">Tailor</span>
            </button>

            {/* Mobile dropdown */}
            <div className="md:hidden">
              <select
                value={active}
                onChange={(e) => scrollTo(e.target.value)}
                className="text-[11px] rounded-lg px-2 py-1.5 border appearance-none"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                aria-label="Navigate"
              >
                {nav.map((n) => (<option key={n.id} value={n.id}>{n.label}</option>))}
              </select>
            </div>
          </div>
        </div>
      </nav>

      {/* Sections */}
      <main id="main" tabIndex={-1} className="max-w-4xl mx-auto px-4 md:px-8">
        {/* Overview */}
        <section id="overview" className="pt-20 pb-28">
          <OverviewHero
            jobTitle={data.job_analysis.job_title}
            company={data.job_analysis.company}
            experience={data.job_analysis.experience_required}
            score={data.match_analysis.match_score}
            recommendation={data.match_analysis.recommendation}
            reason={data.match_analysis.recommendation_reason}
            matched={data.match_analysis.matching_skills.length}
            gaps={data.match_analysis.skill_gaps.length}
            total={data.match_analysis.required_skills.length}
            onScrollToTailor={() => scrollTo("tailor")}
          />
        </section>

        {/* Skill Constellation */}
        <section className="pb-28">
          <Reveal>
            <SkillConstellation
              matching={data.match_analysis.matching_skills}
              gaps={data.match_analysis.skill_gaps}
              niceToHave={data.job_analysis.nice_to_have}
            />
          </Reveal>
        </section>

        {/* Requirements */}
        <section id="requirements" className="pb-28">
          <Reveal>
            <RequirementsBlock
              technical={data.job_analysis.technical_skills}
              soft={data.job_analysis.soft_skills}
              responsibilities={data.job_analysis.responsibilities}
              keywords={data.job_analysis.keywords}
              niceToHave={data.job_analysis.nice_to_have}
            />
          </Reveal>
        </section>

        {/* Match */}
        <section id="match" className="pb-28">
          <Reveal>
            <MatchBlock
              required={data.match_analysis.required_skills}
              matching={data.match_analysis.matching_skills}
              gaps={data.match_analysis.skill_gaps}
            />
          </Reveal>
        </section>

        {/* Improvements */}
        <section id="improvements" className="pb-28">
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
        <section id="tailor" className="pb-28">
          <Reveal>
            <TailoredResumeAction
              data={data}
              resumeFile={resumeFile}
              jobDescription={jobDescription}
            />
          </Reveal>
        </section>

        {/* Details (expandable) */}
        <section className="pb-28">
          <Reveal>
            <DetailsBlock
              summary={data.job_analysis.summary}
              missing={data.resume_optimization.missing_or_weak_requirements}
              warnings={data.resume_optimization.warnings}
            />
          </Reveal>
        </section>

        {/* Application Brief */}
        <section id="brief" className="pb-32">
          <Reveal>
            <ApplicationBrief data={data} />
          </Reveal>
        </section>
      </main>
    </div>
  );
}
