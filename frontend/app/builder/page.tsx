"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ResumeData,
  createEmptyResume,
  mergeExtracted,
  RESUME_STORAGE_KEY,
  readTailoredMeta,
  clearTailoredMeta,
  restoreResumeBackup,
  TailoredMeta,
} from "@/lib/resume-types";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { ResumeImport } from "@/components/resume/ResumeImport";
import { Icon, type IconName } from "@/components/ui/Icon";
import { BackButton } from "@/components/ui/BackButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AppHeader } from "@/components/ui/AppHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Spotlight } from "@/components/motion/Spotlight";
import { useRouter } from "next/navigation";

const EASE = [0.16, 1, 0.3, 1] as const;

const STORAGE_KEY = RESUME_STORAGE_KEY;

type Screen = "entry" | "import" | "builder";

export default function BuilderPage() {
  const router = useRouter();
  const [data, setData] = useState<ResumeData>(createEmptyResume());
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>("entry");
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [imported, setImported] = useState(false);
  const [tailoredMeta, setTailoredMeta] = useState<TailoredMeta | null>(null);

  // Hydrate from localStorage after mount — it cannot be read during render
  // without breaking hydration, so these writes are deliberate.
  useEffect(() => {
    let hasSaved = false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData({ ...createEmptyResume(), ...parsed });
        // If there's meaningful saved data, skip the entry screen
        if (parsed?.personal?.fullName || parsed?.summary || (parsed?.experience?.length)) {
          hasSaved = true;
        }
      }
    } catch {}
    // If the resume was just tailored, jump straight into the editor and show
    // the tailored banner + change summary.
    const meta = readTailoredMeta();
    if (meta) {
      setTailoredMeta(meta);
      hasSaved = true;
    }
    if (hasSaved) setScreen("builder");
    setLoaded(true);
  }, []);

  // Autosave, debounced: without this the whole resume is serialized to
  // localStorage on every keystroke.
  useEffect(() => {
    if (!loaded || screen !== "builder") return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {}
    }, 400);
    return () => clearTimeout(id);
  }, [data, loaded, screen]);

  const handleClear = () => {
    setData(createEmptyResume());
    setImported(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setScreen("entry");
  };

  const handleImported = (partial: Partial<ResumeData>) => {
    setData(mergeExtracted(partial));
    setImported(true);
    setScreen("builder");
  };

  // Hydrating from localStorage: hold the page frame so there is no flash of
  // the entry screen for users who already have a saved resume.
  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col" aria-busy="true">
        <AppHeader crumb="Resume Builder" right={<ThemeToggle />} />
        <div className="flex-1 flex items-center justify-center">
          <span className="spinner" style={{ width: 20, height: 20, color: "var(--text-muted)" }} aria-hidden="true" />
          <span className="sr-only">Loading your resume…</span>
        </div>
      </div>
    );
  }

  // ── ENTRY SCREEN ──
  if (screen === "entry") {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[560px] grid-bg opacity-60 pointer-events-none" aria-hidden="true" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] max-w-full h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(50% 60% at 50% 0%, var(--accent-dim), transparent 70%)" }}
          aria-hidden="true"
        />
        <AppHeader
          back={<BackButton label="Back" onFallback={() => router.push("/")} />}
          crumb="Resume Builder"
          right={<ThemeToggle />}
        />

        <main id="main" tabIndex={-1} className="relative flex-1 flex items-center justify-center px-[var(--gutter)] py-14 sm:py-20 outline-none">
          <div className="w-full max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
              className="text-center mb-10 sm:mb-12"
            >
              <p className="eyebrow mb-4 justify-center">
                <span className="w-4 h-px" style={{ background: "currentColor" }} aria-hidden="true" />
                Resume Builder
              </p>
              <h1 className="display-md" style={{ color: "var(--text)" }}>
                Create your <span className="serif-accent" style={{ color: "var(--accent-bright)" }}>resume</span>
              </h1>
              <p className="mt-3 text-[15px]" style={{ color: "var(--text-secondary)" }}>
                Choose how you&apos;d like to get started.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Build from scratch */}
              <EntryOption
                delay={0.1}
                icon="pencil"
                title="Build from scratch"
                body="Create your resume manually using the resume builder."
                cta="Build from scratch"
                meta="Blank template · live A4 preview"
                onClick={() => { setData(createEmptyResume()); setScreen("builder"); }}
              />

              {/* Upload existing */}
              <EntryOption
                delay={0.18}
                icon="document"
                title="I have an existing resume"
                body="Upload your existing resume and we'll fill the builder for you."
                cta="Upload existing resume"
                meta="PDF · parsed into editable sections"
                onClick={() => setScreen("import")}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── IMPORT SCREEN ──
  if (screen === "import") {
    return <ResumeImport onImported={handleImported} onBack={() => setScreen("entry")} />;
  }

  // ── BUILDER ──
  return (
    <div className="h-[100dvh] flex flex-col print:h-auto print:block">
      <AppHeader
        className="shrink-0"
        maxWidth="max-w-none"
        back={<BackButton label="Back" onFallback={() => router.push("/")} />}
        crumb="Resume Builder"
        right={
          <>
            <div className="md:hidden">
              <Tabs<"editor" | "preview">
                label="Builder view"
                size="sm"
                value={tab}
                onChange={setTab}
                items={[
                  { id: "editor", label: "Editor" },
                  { id: "preview", label: "Preview" },
                ]}
              />
            </div>
            <ThemeToggle />
          </>
        }
      />

      {/* Tailored banner (new agent) */}
      <AnimatePresence>
        {tailoredMeta && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="print:hidden overflow-hidden border-b shrink-0"
            style={{ background: "linear-gradient(120deg, var(--accent-dim), var(--green-dim))", borderColor: "var(--border-subtle)" }}
          >
            <div className="px-[var(--gutter)] py-3.5 max-h-[38vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex items-start gap-3">
                  <span className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--accent)", color: "#fff" }}>
                    <Icon name="sparkle" size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                      Tailored resume generated
                    </p>
                    <p className="text-[12.5px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      All recommendations and required skills were added directly into your resume.
                      If you don&apos;t have any of these in your tech stack, you can easily remove or adjust them here before exporting.
                    </p>

                    {tailoredMeta.addedSkills && tailoredMeta.addedSkills.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-mono uppercase tracking-[0.12em] mr-1" style={{ color: "var(--text-muted)" }}>
                          Added skills
                        </span>
                        {tailoredMeta.addedSkills.map((skill) => (
                          <span key={skill} className="chip !py-1 !text-[11.5px]" style={{ background: "var(--surface)" }}>
                            <Icon name="check" size={10} strokeWidth={2.5} style={{ color: "var(--green)" }} />
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {tailoredMeta.changes.length > 0 && (
                      <ul className="mt-2.5 space-y-1">
                        {tailoredMeta.changes.map((c, i) => (
                          <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                            <span className="mt-0.5 shrink-0" style={{ color: "var(--green)" }}><Icon name="check" size={12} /></span>
                            <span><span className="font-medium capitalize" style={{ color: "var(--text)" }}>{c.section}</span>
                            {c.description ? ` — ${c.description}` : ""}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="secondary"
                    size="xs"
                    iconLeft="refresh"
                    onClick={() => {
                      if (restoreResumeBackup()) {
                        try {
                          const saved = localStorage.getItem(STORAGE_KEY);
                          if (saved) setData({ ...createEmptyResume(), ...JSON.parse(saved) });
                        } catch {}
                      }
                      clearTailoredMeta();
                      setTailoredMeta(null);
                    }}
                  >
                    <span className="hidden sm:inline">Restore original</span>
                    <span className="sm:hidden">Restore</span>
                  </Button>
                  <button
                    type="button"
                    onClick={() => { clearTailoredMeta(); setTailoredMeta(null); }}
                    className="icon-btn"
                    style={{ color: "var(--text-secondary)" }}
                    aria-label="Dismiss tailored resume summary"
                  >
                    <Icon name="x" size={15} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Imported banner */}
      <AnimatePresence>
        {imported && !tailoredMeta && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="print:hidden overflow-hidden border-b shrink-0"
            style={{ background: "var(--green-dim)", borderColor: "var(--border-subtle)" }}
            role="status"
          >
            <div className="px-[var(--gutter)] py-2.5 flex items-center justify-between gap-3 text-[13px]" style={{ color: "var(--text)" }}>
              <span className="inline-flex items-center gap-2">
                <span style={{ color: "var(--green)" }}><Icon name="check" size={14} strokeWidth={2.5} /></span>
                Your resume has been imported. Review the information below before downloading.
              </span>
              <button onClick={() => setImported(false)} className="icon-btn shrink-0" style={{ color: "var(--text-secondary)" }} aria-label="Dismiss"><Icon name="x" size={15} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="main" tabIndex={-1} className="flex-1 flex overflow-hidden print:overflow-visible print:block outline-none">
        <div
          className={`print:hidden w-full md:w-[46%] xl:w-[44%] overflow-y-auto overscroll-contain border-r ${tab === "preview" ? "hidden md:block" : ""}`}
          style={{ borderColor: "var(--border-subtle)", background: "var(--bg)" }}
        >
          <div className="max-w-[720px] mx-auto p-4 sm:p-6 lg:p-8">
            <ResumeEditor data={data} onChange={setData} onClear={handleClear} />
          </div>
        </div>
        <div
          className={`w-full md:w-[54%] xl:w-[56%] overflow-hidden p-4 sm:p-6 print:p-0 print:w-full print:overflow-visible ${tab === "editor" ? "hidden md:block" : ""}`}
          style={{ background: "var(--bg-elevated)" }}
        >
          <ResumePreview data={data} />
        </div>
      </main>
    </div>
  );
}

function EntryOption({
  icon,
  title,
  body,
  cta,
  meta,
  onClick,
  delay,
}: {
  icon: IconName;
  title: string;
  body: string;
  cta: string;
  meta: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay, ease: EASE }}>
      <Spotlight className="h-full rounded-[20px]">
        <button
          type="button"
          onClick={onClick}
          className="card interactive-card group w-full h-full text-left p-6 sm:p-7 !rounded-[20px] flex flex-col"
        >
          <span
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-hover:-rotate-3"
            style={{ background: "var(--accent-dim)", color: "var(--accent-bright)", border: "1px solid var(--accent-glow)" }}
          >
            <Icon name={icon} size={22} />
          </span>
          <h2 className="text-[18px] font-semibold tracking-[-0.015em]" style={{ color: "var(--text)" }}>{title}</h2>
          <p className="text-[14px] leading-relaxed mt-1.5" style={{ color: "var(--text-secondary)" }}>{body}</p>
          <p className="text-[11.5px] font-mono mt-4" style={{ color: "var(--text-muted)" }}>{meta}</p>
          <span className="mt-6 pt-5 border-t inline-flex items-center justify-between gap-1.5 text-[13.5px] font-medium" style={{ color: "var(--accent-bright)", borderColor: "var(--border-subtle)" }}>
            {cta}
            <span className="inline-flex transition-transform duration-300 group-hover:translate-x-1"><Icon name="arrow-right" size={15} /></span>
          </span>
        </button>
      </Spotlight>
    </motion.div>
  );
}
