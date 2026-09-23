"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "./ui/Icon";
import { BackButton } from "./ui/BackButton";
import { ThemeToggle } from "./ui/ThemeToggle";
import { AppHeader } from "./ui/AppHeader";
import { Dropzone } from "./ui/Dropzone";
import { Button } from "./ui/Button";

interface Props {
  /** Resume already chosen earlier in this session (kept across errors/cancel). */
  initialFile?: File | null;
  onAnalyze: (file: File, jobDescription: string) => void;
  error: string;
  onClearError: () => void;
  onBack?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Persist the typed job description so a reload on this screen doesn't lose it.
const JD_DRAFT_KEY = "worthyapply_jd_draft_v1";
// Below this the model has too little to extract requirements from. Advisory
// only — submission is still allowed with any non-empty description.
const JD_SHORT_WORDS = 40;

const EASE = [0.16, 1, 0.3, 1] as const;

export function Workspace({ initialFile = null, onAnalyze, error, onClearError, onBack }: Props) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [jd, setJd] = useState<string>("");
  const [fileError, setFileError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  // Restore any saved JD draft after mount. localStorage cannot be read during
  // render without breaking hydration, so the post-mount write is deliberate.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(JD_DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setJd(saved);
    } catch {}
  }, []);

  // Bring a server error into view and to assistive tech when it appears.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Save the JD draft as the user types (restored above on reload).
  const updateJd = useCallback((value: string) => {
    setJd(value);
    try { localStorage.setItem(JD_DRAFT_KEY, value); } catch {}
  }, []);

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

  const canSubmit = file && jd.trim().length > 0;

  const handleSubmit = () => {
    if (!file) { setFileError("Upload your resume to continue."); return; }
    if (!jd.trim()) return;
    onAnalyze(file, jd.trim());
  };

  const words = jd.trim() ? jd.trim().split(/\s+/).length : 0;
  const jdShort = words > 0 && words < JD_SHORT_WORDS;

  const checklist = [
    { label: "Resume PDF", done: Boolean(file), detail: file ? file.name : "Not added" },
    { label: "Job description", done: jd.trim().length > 0, detail: words ? `${words} words` : "Not added" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="absolute inset-x-0 top-0 h-[480px] grid-bg opacity-60 pointer-events-none" aria-hidden="true" />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] max-w-full h-[360px] pointer-events-none"
        style={{ background: "radial-gradient(50% 60% at 50% 0%, var(--accent-dim), transparent 70%)" }}
        aria-hidden="true"
      />

      <AppHeader
        back={onBack && <BackButton label="Back" onFallback={onBack} />}
        crumb="New analysis"
        onHome={onBack}
        right={
          <>
            <span
              className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-full text-[12px] font-mono"
              style={{ background: "var(--surface-elevated)", color: canSubmit ? "var(--green)" : "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
              aria-live="polite"
            >
              <span className="status-dot" style={{ color: canSubmit ? "var(--green)" : "var(--border-strong)", width: 6, height: 6 }} />
              {file && jd.trim() ? "Ready" : file ? "Need JD" : "Waiting"}
            </span>
            <ThemeToggle />
          </>
        }
      />

      <main id="main" tabIndex={-1} className="relative flex-1 outline-none">
        <div className="max-w-[1200px] mx-auto px-[var(--gutter)] pt-10 sm:pt-14 pb-28 lg:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="max-w-2xl mb-10 sm:mb-12"
          >
            <p className="eyebrow mb-3">
              <span className="w-4 h-px" style={{ background: "currentColor" }} aria-hidden="true" />
              New analysis
            </p>
            <h1 className="display-md" style={{ color: "var(--text)" }}>
              Build your application
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Upload your resume and paste the target job description. We&apos;ll score your fit requirement by requirement.
            </p>
          </motion.div>

          {/* Server / pipeline error */}
          <AnimatePresence>
            {error && (
              <motion.div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="outline-none overflow-hidden"
              >
                <div className="mb-8 p-4 rounded-2xl border flex items-start gap-3" style={{ background: "var(--red-dim)", borderColor: "var(--red-glow)" }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--red-dim)", color: "var(--red)" }}>
                    <Icon name="alert" size={16} />
                  </span>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-medium" style={{ color: "var(--text)" }}>The analysis didn&apos;t finish</p>
                    <p className="text-[13px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{error}</p>
                    <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>Your inputs are still here — you can try again.</p>
                  </div>
                  <button onClick={onClearError} className="icon-btn shrink-0" style={{ color: "var(--text-muted)" }} aria-label="Dismiss error">
                    <Icon name="x" size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid lg:grid-cols-[1fr_340px] gap-8 lg:gap-10 items-start">
            <div className="space-y-8">
              {/* Step 1 — Resume */}
              <motion.section
                aria-labelledby="step-resume"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.7, ease: EASE }}
              >
                <StepLabel n="01" id="step-resume" done={Boolean(file)}>Your resume</StepLabel>
                <Dropzone id="resume-drop" file={file} error={fileError} onFile={handleFile} onClear={() => { setFile(null); setFileError(""); }} />
              </motion.section>

              {/* Step 2 — JD */}
              <motion.section
                aria-labelledby="step-jd"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.7, ease: EASE }}
              >
                <div className="flex items-end justify-between gap-3">
                  <StepLabel n="02" id="step-jd" done={jd.trim().length > 0} htmlFor="jd">Job description</StepLabel>
                  {jd.length > 0 && (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[11px] font-mono tabular" style={{ color: "var(--text-muted)" }}>
                        {words} words · {jd.length} chars
                      </span>
                      <button type="button" onClick={() => updateJd("")} className="text-[12px] font-medium link-underline" style={{ color: "var(--text-secondary)" }}>
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  id="jd"
                  value={jd}
                  onChange={(e) => updateJd(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Paste the full job description — title, responsibilities, requirements, nice-to-haves…"
                  rows={12}
                  data-lenis-prevent
                  aria-describedby="jd-hint"
                  className="field block p-4 sm:p-5 text-[14px] leading-relaxed resize-y min-h-[220px] rounded-2xl"
                />
                <p id="jd-hint" className="mt-2.5 text-[12px] flex items-center gap-1.5" style={{ color: jdShort ? "var(--amber)" : "var(--text-muted)" }}>
                  {jdShort ? (
                    <>
                      <Icon name="alert" size={13} /> This looks short — include the requirements section for a more accurate score.
                    </>
                  ) : (
                    <>Include requirements and nice-to-haves. The more complete, the more precise the match.</>
                  )}
                </p>
              </motion.section>
            </div>

            {/* Readiness panel */}
            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.7, ease: EASE }}
              className="lg:sticky lg:top-[calc(var(--header-h)+24px)]"
              aria-label="Analysis readiness"
            >
              <div className="card-elevated p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>Ready to analyze</p>
                  <span className="text-[11px] font-mono tabular" style={{ color: "var(--text-muted)" }}>{doneCount}/2</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden mb-5" style={{ background: "var(--surface-elevated)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: doneCount === 2 ? "var(--green)" : "var(--accent)" }}
                    animate={{ width: `${(doneCount / 2) * 100}%` }}
                    transition={{ duration: 0.6, ease: EASE }}
                  />
                </div>
                <ul className="space-y-3 mb-6">
                  {checklist.map((c) => (
                    <li key={c.label} className="flex items-center gap-3">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300"
                        style={{ background: c.done ? "var(--green-dim)" : "var(--surface-elevated)", color: c.done ? "var(--green)" : "var(--text-muted)", border: c.done ? "none" : "1px dashed var(--border-strong)" }}
                      >
                        {c.done && <Icon name="check" size={12} strokeWidth={2.5} />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{c.label}</p>
                        <p className="text-[12px] truncate" style={{ color: "var(--text-muted)" }}>{c.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hidden lg:block">
                  <Button size="lg" fullWidth onClick={handleSubmit} disabled={!canSubmit} iconRight="arrow-right">
                    Analyze application
                  </Button>
                  <SubmitHint file={file} jd={jd} />
                </div>

                <div className="mt-6 pt-5 border-t space-y-2.5" style={{ borderColor: "var(--border-subtle)" }}>
                  {[
                    { icon: "zap" as const, t: "Streams live — usually 15–40 seconds" },
                    { icon: "sparkle" as const, t: "Then tailor your resume in one click" },
                  ].map((r) => (
                    <p key={r.t} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                      <Icon name={r.icon} size={13} style={{ color: "var(--accent-bright)" }} /> {r.t}
                    </p>
                  ))}
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </main>

      {/* Mobile / tablet: the primary action stays in reach at the bottom. */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t px-[var(--gutter)] pt-3"
        style={{
          background: "var(--nav-bg)",
          borderColor: "var(--border-subtle)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <Button size="lg" fullWidth onClick={handleSubmit} disabled={!canSubmit} iconRight="arrow-right">
          Analyze application
        </Button>
        <SubmitHint file={file} jd={jd} />
      </div>
    </div>
  );
}

function StepLabel({ n, id, done, htmlFor, children }: { n: string; id: string; done: boolean; htmlFor?: string; children: React.ReactNode }) {
  const Tag = htmlFor ? "label" : "h2";
  return (
    <Tag id={id} {...(htmlFor ? { htmlFor } : {})} className="flex items-center gap-2.5 mb-3">
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-mono transition-colors duration-300"
        style={{ background: done ? "var(--green-dim)" : "var(--surface-elevated)", color: done ? "var(--green)" : "var(--text-muted)" }}
      >
        {done ? <Icon name="check" size={12} strokeWidth={2.5} /> : n}
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text)" }}>{children}</span>
    </Tag>
  );
}

function SubmitHint({ file, jd }: { file: File | null; jd: string }) {
  const canSubmit = file && jd.trim().length > 0;
  return (
    <p className="mt-2.5 text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
      {!canSubmit ? (
        !file && !jd.trim()
          ? "Add your resume and a job description to continue."
          : !file
          ? "Add your resume to continue."
          : "Paste the job description to continue."
      ) : (
        <span className="hidden sm:inline">
          Tip: press <kbd className="font-mono px-1.5 py-0.5 rounded border text-[11px]" style={{ borderColor: "var(--border)" }}>⌘/Ctrl</kbd>{" "}
          + <kbd className="font-mono px-1.5 py-0.5 rounded border text-[11px]" style={{ borderColor: "var(--border)" }}>Enter</kbd> in the description
        </span>
      )}
    </p>
  );
}
