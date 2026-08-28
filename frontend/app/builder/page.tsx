"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ResumeData, createEmptyResume } from "@/lib/resume-types";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { ResumePreview } from "@/components/resume/ResumePreview";

const STORAGE_KEY = "worthyapply_resume_v3";

export default function BuilderPage() {
  const [data, setData] = useState<ResumeData>(createEmptyResume());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview">("editor");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData({ ...createEmptyResume(), ...parsed });
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [data, loaded]);

  const handleClear = () => {
    setData(createEmptyResume());
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  if (!loaded) return null;

  return (
    <div className="h-screen flex flex-col print:h-auto print:block">
      {/* Header — hidden in print */}
      <header className="print:hidden px-4 md:px-8 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text)" }}>
            WorthyApply
          </Link>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/ Resume Builder</span>
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--surface)" }}>
          <button onClick={() => setTab("editor")} className="px-3 py-1 text-[11px] font-medium rounded-md" style={{ background: tab === "editor" ? "var(--surface-elevated)" : "transparent", color: tab === "editor" ? "var(--text)" : "var(--text-muted)" }}>Editor</button>
          <button onClick={() => setTab("preview")} className="px-3 py-1 text-[11px] font-medium rounded-md" style={{ background: tab === "preview" ? "var(--surface-elevated)" : "transparent", color: tab === "preview" ? "var(--text)" : "var(--text-muted)" }}>Preview</button>
        </div>
      </header>

      {/* Two-panel workspace */}
      <div className="flex-1 flex overflow-hidden print:overflow-visible print:block">
        {/* Editor */}
        <div className={`print:hidden w-full md:w-[46%] overflow-y-auto p-4 md:p-6 border-r ${tab === "preview" ? "hidden md:block" : ""}`} style={{ borderColor: "var(--border-subtle)" }}>
          <ResumeEditor data={data} onChange={setData} onClear={handleClear} />
        </div>

        {/* Preview */}
        <div className={`w-full md:w-[54%] overflow-hidden p-4 md:p-6 print:p-0 print:w-full print:overflow-visible ${tab === "editor" ? "hidden md:block" : ""}`}>
          <ResumePreview data={data} />
        </div>
      </div>
    </div>
  );
}
