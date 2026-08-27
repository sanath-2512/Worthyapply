"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ResumeData, createEmptyResume } from "@/lib/resume-types";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { ResumePreview } from "@/components/resume/ResumePreview";
import Link from "next/link";

const STORAGE_KEY = "worthyapply_resume";

export default function BuilderPage() {
  const [data, setData] = useState<ResumeData>(createEmptyResume());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview">("editor");

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setData(JSON.parse(saved));
    } catch {}
    setLoaded(true);
  }, []);

  // Autosave
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 md:px-8 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text)" }}>
            WorthyApply
          </Link>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/ Resume Builder</span>
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--surface)" }}>
          <button
            onClick={() => setTab("editor")}
            className="px-3 py-1 text-[11px] font-medium rounded-md"
            style={{ background: tab === "editor" ? "var(--surface-elevated)" : "transparent", color: tab === "editor" ? "var(--text)" : "var(--text-muted)" }}
          >
            Editor
          </button>
          <button
            onClick={() => setTab("preview")}
            className="px-3 py-1 text-[11px] font-medium rounded-md"
            style={{ background: tab === "preview" ? "var(--surface-elevated)" : "transparent", color: tab === "preview" ? "var(--text)" : "var(--text-muted)" }}
          >
            Preview
          </button>
        </div>
      </header>

      {/* Desktop: side by side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`w-full md:w-1/2 overflow-y-auto p-4 md:p-6 border-r ${tab === "preview" ? "hidden md:block" : ""}`}
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <ResumeEditor data={data} onChange={setData} onClear={handleClear} />
        </motion.div>

        {/* Preview */}
        <div className={`w-full md:w-1/2 overflow-y-auto p-4 md:p-6 ${tab === "editor" ? "hidden md:block" : ""}`}>
          <ResumePreview data={data} />
        </div>
      </div>
    </div>
  );
}
