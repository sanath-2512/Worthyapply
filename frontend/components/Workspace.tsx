"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onAnalyze: (file: File, jobDescription: string) => void;
  error: string;
  onClearError: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function Workspace({ onAnalyze, error, onClearError }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File): string | null => {
    if (!f.name.toLowerCase().endsWith(".pdf")) return "Only PDF files are accepted.";
    if (f.size > MAX_FILE_SIZE) return "File too large. Maximum 10 MB.";
    if (f.size === 0) return "File is empty.";
    return null;
  };

  const handleFile = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) { setFileError(err); setFile(null); }
    else { setFileError(""); setFile(f); onClearError(); }
  }, [onClearError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const canSubmit = file && jd.trim().length > 0;

  const handleSubmit = () => {
    if (!file) { setFileError("Upload your resume to continue."); return; }
    if (!jd.trim()) return;
    onAnalyze(file, jd.trim());
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] rounded-full blur-[120px] opacity-[0.04] pointer-events-none"
        style={{ background: "var(--accent)" }}
      />

      {/* Header */}
      <header className="px-6 md:px-12 py-5 flex items-center justify-between border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text)" }}>
          WorthyApply
        </span>
        <div className="flex items-center gap-2">
          {file && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)" }} />}
          <span className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
            {file && jd.trim() ? "Ready" : file ? "Need JD" : "Waiting"}
          </span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ color: "var(--text)" }}>
              Build your application
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Upload your resume and paste the target job description.
            </p>
          </motion.div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="mb-6 p-4 rounded-xl border"
                style={{ background: "var(--red-dim)", borderColor: "rgba(255,0,102,0.2)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>
                  <button onClick={onClearError} className="ml-3 opacity-60 hover:opacity-100" style={{ color: "var(--red)" }} aria-label="Dismiss">✕</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            {/* Upload */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5 }}>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-2.5" style={{ color: "var(--text-muted)" }}>
                Resume
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
                aria-label="Upload resume PDF"
                className="group border rounded-2xl p-5 cursor-pointer transition-all duration-300"
                style={{
                  borderColor: dragOver ? "var(--accent)" : fileError ? "var(--red)" : "var(--border)",
                  background: dragOver ? "var(--accent-dim)" : "var(--surface)",
                }}
              >
                <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                {file ? (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--green-dim)" }}>
                      <span className="text-[10px] font-bold" style={{ color: "var(--green)", fontFamily: "'JetBrains Mono', monospace" }}>✓</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{file.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setFileError(""); }}
                      className="text-[11px] px-3 py-1.5 rounded-lg transition-colors hover:opacity-70"
                      style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-sm mb-0.5" style={{ color: "var(--text-secondary)" }}>Drop your resume here or click to browse</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>PDF · Max 10 MB</p>
                  </div>
                )}
              </div>
              {fileError && <p className="mt-2 text-[11px]" style={{ color: "var(--red)" }}>{fileError}</p>}
            </motion.div>

            {/* JD */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
              <div className="flex items-center justify-between mb-2.5">
                <label htmlFor="jd" className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>Job Description</label>
                {jd.length > 0 && (
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>{jd.length}</span>
                )}
              </div>
              <textarea
                id="jd" value={jd} onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full job description here..."
                rows={10}
                className="w-full rounded-2xl p-5 text-sm leading-relaxed resize-y border transition-all duration-300 focus:outline-none focus:border-[var(--accent)]"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </motion.div>

            {/* Submit */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
              <button
                onClick={handleSubmit} disabled={!canSubmit}
                className={`magnetic-btn w-full py-4 rounded-2xl text-sm font-semibold transition-all duration-300 ${canSubmit ? "cursor-pointer" : "opacity-20 cursor-not-allowed"}`}
                style={{
                  background: canSubmit ? "var(--accent)" : "var(--border)",
                  color: canSubmit ? "#fff" : "var(--text-muted)",
                  boxShadow: canSubmit ? "0 8px 32px rgba(108, 99, 255, 0.25)" : "none",
                }}
              >
                Analyze Application →
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
