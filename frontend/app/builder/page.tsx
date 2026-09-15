"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { Icon } from "@/components/ui/Icon";
import { BackButton } from "@/components/ui/BackButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useRouter } from "next/navigation";

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

  if (!loaded) return null;

  // ── ENTRY SCREEN ──
  if (screen === "entry") {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="px-4 md:px-8 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-4">
            <BackButton label="Back" onFallback={() => router.push("/")} />
            <Link href="/" className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text)" }}>WorthyApply</Link>
            <span className="hidden sm:inline text-[10px]" style={{ color: "var(--text-muted)" }}>/ Resume Builder</span>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-2xl"
          >
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ color: "var(--text)" }}>
                Create your resume
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Choose how you&apos;d like to get started.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Build from scratch */}
              <button
                onClick={() => { setData(createEmptyResume()); setScreen("builder"); }}
                className="text-left p-6 rounded-2xl border transition-all duration-200 hover:border-[var(--accent)] group"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--surface-elevated)", color: "var(--accent-bright)" }}><Icon name="pencil" size={20} /></div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>Build from scratch</h2>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Create your resume manually using the resume builder.
                </p>
                <span className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-medium group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--accent)" }}>
                  Build from scratch <Icon name="arrow-right" size={13} />
                </span>
              </button>

              {/* Upload existing */}
              <button
                onClick={() => setScreen("import")}
                className="text-left p-6 rounded-2xl border transition-all duration-200 hover:border-[var(--accent)] group"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: "var(--surface-elevated)", color: "var(--accent-bright)" }}><Icon name="document" size={20} /></div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>I have an existing resume</h2>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Upload your existing resume and we&apos;ll fill the builder for you.
                </p>
                <span className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-medium group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--accent)" }}>
                  Upload existing resume <Icon name="arrow-right" size={13} />
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── IMPORT SCREEN ──
  if (screen === "import") {
    return <ResumeImport onImported={handleImported} onBack={() => setScreen("entry")} />;
  }

  // ── BUILDER ──
  return (
    <div className="h-screen flex flex-col print:h-auto print:block">
      <header className="print:hidden px-4 md:px-8 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-4">
          <BackButton label="Back" onFallback={() => router.push("/")} />
          <Link href="/" className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text)" }}>WorthyApply</Link>
          <span className="hidden sm:inline text-[10px]" style={{ color: "var(--text-muted)" }}>/ Resume Builder</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="md:hidden flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--surface)" }}>
            <button onClick={() => setTab("editor")} className="px-3 py-1 text-[11px] font-medium rounded-md" style={{ background: tab === "editor" ? "var(--surface-elevated)" : "transparent", color: tab === "editor" ? "var(--text)" : "var(--text-muted)" }}>Editor</button>
            <button onClick={() => setTab("preview")} className="px-3 py-1 text-[11px] font-medium rounded-md" style={{ background: tab === "preview" ? "var(--surface-elevated)" : "transparent", color: tab === "preview" ? "var(--text)" : "var(--text-muted)" }}>Preview</button>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Tailored banner (new agent) */}
      <AnimatePresence>
        {tailoredMeta && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="print:hidden px-4 md:px-8 py-3 border-b"
            style={{ background: "var(--accent-dim)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold inline-flex items-start gap-1.5" style={{ color: "var(--accent-bright)" }}>
                  <span className="mt-0.5 shrink-0"><Icon name="sparkle" size={14} /></span>
                  <span>
                    Tailored resume generated: All recommendations and required skills were added directly into your resume.
                    If you don&apos;t have any of these in your tech stack, you can easily remove or adjust them here before exporting.
                  </span>
                </p>

                {tailoredMeta.addedSkills && tailoredMeta.addedSkills.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Added skills:
                    </span>
                    {tailoredMeta.addedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{
                          background: "var(--surface)",
                          color: "var(--text)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <Icon name="check" size={10} style={{ color: "var(--green)" }} />
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {tailoredMeta.changes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {tailoredMeta.changes.map((c, i) => (
                      <li key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                        <span className="mt-0.5 shrink-0" style={{ color: "var(--green)" }}><Icon name="check" size={12} /></span>
                        <span><span className="font-medium capitalize">{c.section}</span>
                        {c.description ? ` — ${c.description}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
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
                  className="text-[11px] px-2.5 py-1 rounded-lg"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                >
                  Restore original
                </button>
                <button
                  type="button"
                  onClick={() => { clearTailoredMeta(); setTailoredMeta(null); }}
                  className="icon-btn opacity-70 hover:opacity-100"
                  style={{ color: "var(--accent-bright)" }}
                  aria-label="Dismiss tailored resume summary"
                >
                  <Icon name="x" size={15} />
                </button>
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
            className="print:hidden px-4 md:px-8 py-2.5 flex items-center justify-between text-[12px] border-b"
            style={{ background: "var(--accent-dim)", borderColor: "var(--border-subtle)", color: "var(--accent-bright)" }}
          >
            <span>Your resume has been imported. Review the information below before downloading.</span>
            <button onClick={() => setImported(false)} className="icon-btn opacity-70 hover:opacity-100" aria-label="Dismiss"><Icon name="x" size={15} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden print:overflow-visible print:block">
        <div className={`print:hidden w-full md:w-[46%] overflow-y-auto p-4 md:p-6 border-r ${tab === "preview" ? "hidden md:block" : ""}`} style={{ borderColor: "var(--border-subtle)" }}>
          <ResumeEditor data={data} onChange={setData} onClear={handleClear} />
        </div>
        <div className={`w-full md:w-[54%] overflow-hidden p-4 md:p-6 print:p-0 print:w-full print:overflow-visible ${tab === "editor" ? "hidden md:block" : ""}`}>
          <ResumePreview data={data} />
        </div>
      </div>
    </div>
  );
}
