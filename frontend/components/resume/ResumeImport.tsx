"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResumeData } from "@/lib/resume-types";
import { extractResumeStream, ApiError, PipelineEvent } from "@/lib/api";
import { Icon } from "../ui/Icon";
import { ThemeToggle } from "../ui/ThemeToggle";
import { AppHeader } from "../ui/AppHeader";
import { BackButton } from "../ui/BackButton";
import { Dropzone } from "../ui/Dropzone";
import { Button } from "../ui/Button";
import { StreamConsole } from "../ui/StreamConsole";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  onImported: (data: Partial<ResumeData>) => void;
  onBack: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function ResumeImport({ onImported, onBack }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Reading your resume...");
  const [liveText, setLiveText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight stream if the component unmounts.
    return () => abortRef.current?.abort();
  }, []);

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

  const handleEvent = (event: PipelineEvent) => {
    switch (event.type) {
      case "agent_progress":
        setStatusMsg(event.message);
        break;
      case "agent_token":
        setLiveText((prev) => prev + event.text);
        break;
      default:
        break;
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setProcessing(true);
    setError("");
    setLiveText("");
    setStatusMsg("Reading your resume...");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const extracted = await extractResumeStream(file, handleEvent, controller.signal);
      // brief pause so the user sees completion
      await new Promise((r) => setTimeout(r, 300));
      onImported(extracted);
    } catch (err) {
      if (controller.signal.aborted) return;
      setProcessing(false);
      setError(err instanceof ApiError ? err.message : "Could not read your resume. Please try again.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[520px] grid-bg opacity-60 pointer-events-none" aria-hidden="true" />
      <AppHeader
        back={!processing ? <BackButton label="Back" canGoBack={false} onFallback={onBack} /> : undefined}
        crumb={<>Resume Builder <span style={{ color: "var(--border-strong)" }}>/</span> Import</>}
        right={<ThemeToggle />}
      />

      <main id="main" tabIndex={-1} className="relative flex-1 flex items-center justify-center px-[var(--gutter)] py-12 sm:py-16 outline-none">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {!processing ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <p className="eyebrow mb-3">
                  <span className="w-4 h-px" style={{ background: "currentColor" }} aria-hidden="true" />
                  Import
                </p>
                <h1 className="display-md" style={{ color: "var(--text)" }}>
                  Upload your resume
                </h1>
                <p className="text-[15px] mt-3 mb-8 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  We&apos;ll read it and fill in the builder automatically. You can review and edit everything afterward.
                </p>

                {error && file !== null && (
                  <div role="alert" className="mb-5 p-4 rounded-2xl border flex items-start gap-3" style={{ background: "var(--red-dim)", borderColor: "var(--red-glow)" }}>
                    <span className="mt-0.5 shrink-0" style={{ color: "var(--red)" }}><Icon name="alert" size={16} /></span>
                    <div>
                      <p className="text-[14px] font-medium" style={{ color: "var(--text)" }}>Import didn&apos;t finish</p>
                      <p className="text-[13px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{error}</p>
                    </div>
                  </div>
                )}

                <Dropzone
                  id="import-drop"
                  file={file}
                  // Validation errors (no file kept) show under the drop target;
                  // server errors (file kept) show in the banner above.
                  error={file === null ? error : undefined}
                  onFile={handleFile}
                  onClear={() => { setFile(null); setError(""); }}
                />

                <Button size="lg" fullWidth className="mt-6" onClick={handleImport} disabled={!file} iconRight="arrow-right">
                  {error && file ? "Try again" : "Import Resume"}
                </Button>
                <p className="mt-3 text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
                  Text-based PDFs work best. Nothing is changed until you review it.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="text-center"
              >
                <div className="relative mx-auto mb-8 w-[132px]" aria-hidden="true">
                  <div className="rounded-lg p-3 space-y-1.5 text-left" style={{ background: "#fff", aspectRatio: "210 / 297", boxShadow: "var(--viewer-shadow)" }}>
                    <div className="skeleton h-2 w-2/3 !bg-[#e6e6ec]" />
                    <div className="skeleton h-1 w-5/6 !bg-[#f0f0f4]" />
                    {[0, 1, 2].map((k) => (
                      <div key={k} className="space-y-1 pt-1.5">
                        <div className="skeleton h-1.5 w-1/3 !bg-[#e4e4ea]" />
                        <div className="skeleton h-1 w-full !bg-[#f0f0f4]" />
                        <div className="skeleton h-1 w-11/12 !bg-[#f0f0f4]" />
                      </div>
                    ))}
                  </div>
                  {/* Scan line */}
                  <motion.div
                    className="absolute inset-x-[-10px] h-8"
                    style={{ background: "linear-gradient(180deg, transparent, var(--accent-glow), transparent)" }}
                    animate={{ top: ["-10%", "90%", "-10%"] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <h2 className="heading" style={{ color: "var(--text)" }}>
                  Importing your resume
                </h2>
                <p className="text-[13.5px] mt-2 mb-6 inline-flex items-center gap-2" style={{ color: "var(--text-secondary)" }} aria-live="polite">
                  <span className="spinner" style={{ width: 13, height: 13, color: "var(--accent-bright)" }} aria-hidden="true" />
                  {statusMsg}
                </p>
                <StreamConsole text={liveText} label="parsing" tail={600} className="text-left" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
