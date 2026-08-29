"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ResumeData, createEmptyResume, mergeExtracted } from "@/lib/resume-types";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { ResumeImport } from "@/components/resume/ResumeImport";

const STORAGE_KEY = "worthyapply_resume_v3";

type Screen = "entry" | "import" | "builder";

export default function BuilderPage() {
  const [data, setData] = useState<ResumeData>(createEmptyResume());
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>("entry");
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [imported, setImported] = useState(false);

  useEffect(() => {
    let hasSaved = false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData({ ...createEmptyResume(), ...parsed });
        // If there's meaningful saved data, skip the entry screen
        if (parsed?.personal?.fullName || parsed?.summary || (parsed?.experience?.length)) {
          hasSaved = true;
        }
      }
    } catch {}
    if (hasSaved) setScreen("builder");
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || screen !== "builder") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
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
        <header className="px-4 md:px-8 py-4 border-b flex items-center gap-4" style={{ borderColor: "var(--border-subtle)" }}>
          <Link href="/" className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text)" }}>WorthyApply</Link>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/ Resume Builder</span>
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
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-lg" style={{ background: "var(--surface-elevated)" }}>✏️</div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>Build from scratch</h2>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Create your resume manually using the resume builder.
                </p>
                <span className="inline-block mt-4 text-[12px] font-medium group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--accent)" }}>
                  Build from scratch →
                </span>
              </button>

              {/* Upload existing */}
              <button
                onClick={() => setScreen("import")}
                className="text-left p-6 rounded-2xl border transition-all duration-200 hover:border-[var(--accent)] group"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-lg" style={{ background: "var(--surface-elevated)" }}>📄</div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>I have an existing resume</h2>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Upload your existing resume and we&apos;ll fill the builder for you.
                </p>
                <span className="inline-block mt-4 text-[12px] font-medium group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--accent)" }}>
                  Upload existing resume →
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
          <Link href="/" className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text)" }}>WorthyApply</Link>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/ Resume Builder</span>
        </div>

        <div className="md:hidden flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--surface)" }}>
          <button onClick={() => setTab("editor")} className="px-3 py-1 text-[11px] font-medium rounded-md" style={{ background: tab === "editor" ? "var(--surface-elevated)" : "transparent", color: tab === "editor" ? "var(--text)" : "var(--text-muted)" }}>Editor</button>
          <button onClick={() => setTab("preview")} className="px-3 py-1 text-[11px] font-medium rounded-md" style={{ background: tab === "preview" ? "var(--surface-elevated)" : "transparent", color: tab === "preview" ? "var(--text)" : "var(--text-muted)" }}>Preview</button>
        </div>
      </header>

      {/* Imported banner */}
      <AnimatePresence>
        {imported && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="print:hidden px-4 md:px-8 py-2.5 flex items-center justify-between text-[12px] border-b"
            style={{ background: "var(--accent-dim)", borderColor: "var(--border-subtle)", color: "var(--accent-bright)" }}
          >
            <span>Your resume has been imported. Review the information below before downloading.</span>
            <button onClick={() => setImported(false)} className="opacity-70 hover:opacity-100" aria-label="Dismiss">✕</button>
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
