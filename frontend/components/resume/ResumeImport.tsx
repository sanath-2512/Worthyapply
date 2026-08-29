"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ResumeData } from "@/lib/resume-types";
import { extractResume, ApiError } from "@/lib/api";

interface Props {
  onImported: (data: Partial<ResumeData>) => void;
  onBack: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const stages = [
  "Uploading resume",
  "Reading resume",
  "Extracting information",
  "Organizing your resume",
  "Preparing the builder",
];

export function ResumeImport({ onImported, onBack }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [stage, setStage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const validate = (f: File): string | null => {
    if (!f.name.toLowerCase().endsWith(".pdf")) return "Only PDF files are accepted.";
    if (f.size > MAX_FILE_SIZE) return "File too large. Maximum 10 MB.";
    if (f.size === 0) return "File is empty.";
    return null;
  };

  const handleFile = useCallback((f: File) => {
    const err = validate(f);
    if (err) { setError(err); setFile(null); }
    else { setError(""); setFile(f); }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const startStageAnimation = () => {
    setStage(0);
    let i = 0;
    stageTimer.current = setInterval(() => {
      i = Math.min(i + 1, stages.length - 2); // don't auto-advance to final
      setStage(i);
    }, 2500);
  };

  const stopStageAnimation = () => {
    if (stageTimer.current) clearInterval(stageTimer.current);
  };

  const handleImport = async () => {
    if (!file) return;
    setProcessing(true);
    setError("");
    startStageAnimation();

    try {
      const extracted = await extractResume(file);
      stopStageAnimation();
      setStage(stages.length - 1);
      // brief pause so the user sees completion
      await new Promise((r) => setTimeout(r, 400));
      onImported(extracted);
    } catch (err) {
      stopStageAnimation();
      setProcessing(false);
      setError(err instanceof ApiError ? err.message : "Could not read your resume. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 md:px-8 py-4 border-b flex items-center gap-4" style={{ borderColor: "var(--border-subtle)" }}>
        <Link href="/" className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text)" }}>WorthyApply</Link>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>/ Resume Builder / Import</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {!processing ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <button onClick={onBack} className="text-[11px] mb-6 transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
                  ← Back
                </button>
                <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "var(--text)" }}>
                  Upload your resume
                </h1>
                <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                  We&apos;ll read it and fill in the builder automatically. You can review and edit everything afterward.
                </p>

                {error && (
                  <div className="mb-4 p-3 rounded-lg border text-sm" style={{ background: "var(--red-dim)", borderColor: "rgba(255,0,102,0.2)", color: "var(--red)" }}>
                    {error}
                  </div>
                )}

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
                  aria-label="Upload resume PDF"
                  className="border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-200 text-center"
                  style={{
                    borderColor: dragOver ? "var(--accent)" : error ? "var(--red)" : "var(--border)",
                    background: dragOver ? "var(--accent-dim)" : "var(--surface)",
                  }}
                >
                  <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  {file ? (
                    <div>
                      <div className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>{file.name}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{(file.size / 1024).toFixed(0)} KB · Click to replace</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Drop your resume here or click to browse</div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>PDF · Max 10 MB</div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleImport}
                  disabled={!file}
                  className="magnetic-btn w-full mt-6 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "var(--accent)", color: "#fff", boxShadow: file ? "0 8px 32px rgba(108,99,255,0.25)" : "none" }}
                >
                  Import Resume →
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <motion.div
                  className="mx-auto mb-8 w-14 h-14 rounded-full border-2"
                  style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--text)" }}>
                  Importing your resume
                </h2>
                <div className="space-y-2.5 text-left inline-block">
                  {stages.map((s, i) => (
                    <div key={s} className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                        style={{
                          background: i < stage ? "var(--green)" : i === stage ? "var(--accent)" : "var(--surface-elevated)",
                          color: "#fff",
                        }}
                      >
                        {i < stage ? "✓" : ""}
                      </span>
                      <span className="text-sm" style={{ color: i <= stage ? "var(--text-secondary)" : "var(--text-muted)" }}>{s}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
