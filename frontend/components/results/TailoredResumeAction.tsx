"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AnalysisResponse } from "@/lib/types";
import {
  tailorResumeStream,
  ApiError,
  PipelineEvent,
  ResumeChange,
  RecommendationResult,
} from "@/lib/api";
import { ResumeData, mergeExtracted, saveTailoredResume } from "@/lib/resume-types";
import { useMounted } from "@/lib/use-mounted";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { Icon } from "@/components/ui/Icon";

interface Props {
  data: AnalysisResponse;
  resumeFile: File | null;
  jobDescription: string;
}

type Phase = "idle" | "tailoring" | "done" | "error";
type ViewTab = "preview" | "changes";

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

export function TailoredResumeAction({ data, resumeFile, jobDescription }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveText, setLiveText] = useState("");
  const [statusMsg, setStatusMsg] = useState("Tailoring your resume to this job...");
  const [changes, setChanges] = useState<ResumeChange[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [addedSkills, setAddedSkills] = useState<string[]>([]);
  const [tailoredResume, setTailoredResume] = useState<ResumeData | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("preview");
  const [error, setError] = useState("");
  const [previewScale, setPreviewScale] = useState(0.85);
  const [zoom, setZoom] = useState(1);
  // Measured document height, so the scaled wrapper reserves the right space.
  const [docHeight, setDocHeight] = useState(A4_HEIGHT_PX);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewDocRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useMounted();

  // Compute preview scaling to fit container width
  useEffect(() => {
    if (phase !== "done" || viewTab !== "preview") return;
    const computeScale = () => {
      if (!previewContainerRef.current) return;
      const available = previewContainerRef.current.clientWidth - 48;
      setPreviewScale(Math.min(available / A4_WIDTH_PX, 1));
    };
    computeScale();
    window.addEventListener("resize", computeScale);
    return () => window.removeEventListener("resize", computeScale);
  }, [phase, viewTab]);

  // Measure the rendered document once it is on screen.
  useEffect(() => {
    if (phase !== "done" || viewTab !== "preview") return;
    const el = previewDocRef.current;
    if (!el) return;
    const measure = () => setDocHeight(Math.max(el.scrollHeight, A4_HEIGHT_PX));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase, viewTab, tailoredResume]);

  const canRun = Boolean(resumeFile) && jobDescription.trim().length > 0;

  const handleEvent = (event: PipelineEvent) => {
    if (event.type === "agent_progress") setStatusMsg(event.message);
    else if (event.type === "agent_token") setLiveText((p) => p + event.text);
  };

  const handleGenerate = async () => {
    if (!resumeFile) return;
    setPhase("tailoring");
    setError("");
    setLiveText("");
    setChanges([]);
    setRecommendations([]);
    setAddedSkills([]);
    setTailoredResume(null);
    setStatusMsg("Tailoring your resume to this job...");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await tailorResumeStream(
        resumeFile,
        jobDescription,
        data,
        handleEvent,
        controller.signal
      );
      // Validate before touching any stored resume: require at least a resume object.
      if (!result || !result.resume || typeof result.resume !== "object") {
        throw new ApiError("The tailored resume was incomplete. Please try again.", 0);
      }
      const newAddedSkills = result.added_skills || result.gaps_to_add || [];
      const msg = result.added_skills_message || "All recommendations and target skills were added directly into your resume. If you don't have this in your tech stack, you can remove it in the editor.";
      // Persist as a NEW version; the original builder resume is backed up inside.
      saveTailoredResume(result.resume, result.changes || [], newAddedSkills, msg);
      const merged = mergeExtracted(result.resume);
      setTailoredResume(merged);
      setChanges(result.changes || []);
      setRecommendations(result.recommendations || []);
      setAddedSkills(newAddedSkills);
      setPhase("done");
      setViewTab("preview");
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof ApiError ? err.message : "Could not tailor your resume. Please try again.");
      setPhase("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const goToEditor = () => router.push("/builder");

  const handleDownloadPdf = () => {
    window.print();
  };

  const implementedCount = recommendations.length > 0
    ? recommendations.filter((r) => r.status === "implemented").length
    : changes.length;

  const effectiveScale = previewScale * zoom;

  return (
    <div
      className="rounded-2xl border p-6 md:p-8"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}>
            <span style={{ color: "var(--accent-bright)" }}><Icon name="sparkle" size={16} /></span> Generate Tailored Resume
          </h3>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Apply the recommendations above to your existing resume. You&apos;ll review and
            edit everything in the resume editor before exporting — nothing is final.
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!canRun && (
              <p className="text-[11px] mt-3 mb-1" style={{ color: "var(--amber)" }}>
                The original resume/JD from this session is needed to tailor. Start a new
                analysis if this message persists.
              </p>
            )}
            <button
              onClick={handleGenerate}
              disabled={!canRun}
              className="btn btn-primary magnetic-btn mt-4"
            >
              Generate Tailored Resume
              <Icon name="arrow-right" size={16} />
            </button>
          </motion.div>
        )}

        {phase === "tailoring" && (
          <motion.div key="tailoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5">
            <div className="flex items-center gap-3 mb-3">
              <motion.div
                className="w-4 h-4 rounded-full border-2"
                style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="text-[12px]" style={{ color: "var(--text-secondary)" }} aria-live="polite">
                {statusMsg}
              </span>
            </div>
            {liveText && (
              <div
                className="rounded-xl px-4 py-3 max-h-40 overflow-hidden text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words"
                style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
                aria-live="polite"
              >
                {liveText.slice(-600)}
                <span className="inline-block w-1.5 h-3 ml-0.5 align-middle animate-pulse" style={{ background: "var(--accent)" }} />
              </div>
            )}
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 space-y-6">
            {/* Header & Main Actions */}
            <div
              className="rounded-2xl p-5 md:p-6 border"
              style={{
                background: "linear-gradient(135deg, var(--green-dim) 0%, var(--accent-dim) 100%)",
                borderColor: "var(--green-glow)",
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
                    <Icon name="check" size={13} />
                    <span>Tailored Resume Ready</span>
                  </div>
                  <h4 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                    Customized for {data.job_analysis.job_title}
                  </h4>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    {implementedCount} key optimization{implementedCount === 1 ? "" : "s"} applied directly to your experience & skills.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleDownloadPdf}
                    className="btn btn-primary btn-sm magnetic-btn"
                  >
                    <Icon name="download" size={15} />
                    <span>Download PDF</span>
                  </button>

                  <button
                    onClick={goToEditor}
                    className="btn btn-secondary btn-sm"
                  >
                    <Icon name="pencil" size={15} />
                    <span>Open Editor</span>
                    <Icon name="arrow-right" size={14} className="opacity-60" />
                  </button>

                  <button
                    onClick={handleGenerate}
                    className="btn btn-ghost btn-sm"
                    title="Regenerate with fresh AI tailoring"
                  >
                    <Icon name="refresh" size={14} />
                    Regenerate
                  </button>
                </div>
              </div>
            </div>

            {/* Added Skills & Recommendations Notice Banner */}
            <div
              className="rounded-2xl p-5 md:p-6 border"
              style={{
                background: "linear-gradient(135deg, var(--accent-dim) 0%, var(--green-dim) 100%)",
                borderColor: "var(--accent-glow)",
              }}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5"
                  style={{ background: "var(--accent-dim)", color: "var(--accent-bright)" }}
                >
                  <Icon name="sparkle" size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold mb-1" style={{ color: "var(--text)" }}>
                    Recommendations & Skills Added Directly
                  </h4>
                  <p className="text-[12px] leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
                    All recommendations and target skills for this job were added directly into your tailored resume.
                    <span className="block mt-1 font-semibold" style={{ color: "var(--accent-bright)" }}>
                      If you don&apos;t have any of these in your tech stack, you can easily remove or adjust them in the editor.
                    </span>
                  </p>
                  {addedSkills.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Added Skills & Technologies:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {addedSkills.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: "var(--surface)",
                              color: "var(--text)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <Icon name="check" size={12} style={{ color: "var(--green)" }} /> {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={goToEditor} className="btn btn-secondary btn-sm mt-1">
                    <Icon name="pencil" size={14} />
                    <span>Review / Remove in Editor</span>
                  </button>
                </div>
              </div>
            </div>

            {/* View Selector Tabs */}
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewTab("preview")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewTab === "preview" ? "shadow-sm" : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    background: viewTab === "preview" ? "var(--surface-elevated)" : "transparent",
                    color: viewTab === "preview" ? "var(--text)" : "var(--text-muted)",
                    border: viewTab === "preview" ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  <span className="inline-flex items-center gap-1.5"><Icon name="document" size={14} /> Document Preview</span>
                </button>
                <button
                  onClick={() => setViewTab("changes")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewTab === "changes" ? "shadow-sm" : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    background: viewTab === "changes" ? "var(--surface-elevated)" : "transparent",
                    color: viewTab === "changes" ? "var(--text)" : "var(--text-muted)",
                    border: viewTab === "changes" ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  <span className="inline-flex items-center gap-1.5"><Icon name="zap" size={14} /> Applied Changes ({implementedCount})</span>
                </button>
              </div>

              {viewTab === "preview" && (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "var(--surface)" }}>
                    <button
                      onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                      className="w-5 h-5 rounded flex items-center justify-center text-xs"
                      style={{ color: "var(--text-secondary)" }}
                      aria-label="Zoom out"
                    >
                      −
                    </button>
                    <span className="text-[10px] tabular-nums w-8 text-center" style={{ color: "var(--text-muted)" }}>
                      {Math.round(effectiveScale * 100)}%
                    </span>
                    <button
                      onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                      className="w-5 h-5 rounded flex items-center justify-center text-xs"
                      style={{ color: "var(--text-secondary)" }}
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tab 1: Document Preview */}
            {viewTab === "preview" && tailoredResume && (
              <div
                ref={previewContainerRef}
                className="w-full rounded-2xl overflow-auto p-4 md:p-8 flex justify-center border"
                style={{
                  background: "var(--viewer-bg)",
                  borderColor: "var(--border-subtle)",
                  maxHeight: "700px",
                }}
              >
                <div
                  style={{
                    width: A4_WIDTH_PX * effectiveScale,
                    height: docHeight * effectiveScale,
                  }}
                >
                  <div
                    ref={previewDocRef}
                    style={{
                      transform: `scale(${effectiveScale})`,
                      transformOrigin: "top left",
                      width: A4_WIDTH_PX,
                      boxShadow: "var(--viewer-shadow)",
                    }}
                  >
                    <ResumeDocument data={tailoredResume} />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Changes List */}
            {viewTab === "changes" && (
              <div className="space-y-3">
                {recommendations.length > 0 ? (
                  recommendations.map((rec) => {
                    const done = rec.status === "implemented";
                    return (
                      <div
                        key={rec.id}
                        className="p-3.5 rounded-xl border flex items-start gap-3 text-xs"
                        style={{
                          background: done ? "var(--surface)" : "var(--bg-elevated)",
                          borderColor: done ? "var(--green-glow)" : "var(--border-subtle)",
                        }}
                      >
                        <span
                          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                          style={{
                            background: done ? "var(--green-dim)" : "var(--amber-dim)",
                            color: done ? "var(--green)" : "var(--amber)",
                          }}
                        >
                          {done ? <Icon name="check" size={12} strokeWidth={2.5} /> : <Icon name="alert" size={12} />}
                        </span>
                        <div className="space-y-1">
                          <p className="font-medium" style={{ color: "var(--text)" }}>
                            {rec.recommendation}
                          </p>
                          {done && rec.change && (
                            <p style={{ color: "var(--text-secondary)" }}>
                              <span className="font-semibold text-[11px]" style={{ color: "var(--green)" }}>Applied: </span>
                              {rec.change}
                            </p>
                          )}
                          {!done && rec.reason && (
                            <p style={{ color: "var(--amber)" }}>
                              <span className="font-semibold text-[11px]">Note: </span>
                              {rec.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : changes.length > 0 ? (
                  changes.map((c, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border flex items-start gap-3 text-xs"
                      style={{
                        background: "var(--surface)",
                        borderColor: "var(--green-glow)",
                      }}
                    >
                      <span
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                        style={{ background: "var(--green-dim)", color: "var(--green)" }}
                      >
                        <Icon name="check" size={12} strokeWidth={2.5} />
                      </span>
                      <div>
                        <span className="font-semibold uppercase tracking-wider text-[10px]" style={{ color: "var(--green)" }}>
                          {c.section}:{" "}
                        </span>
                        <span style={{ color: "var(--text-secondary)" }}>{c.description}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
                    No specific changes recorded.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5">
            <div
              className="rounded-xl p-4 mb-4 text-[12px]"
              style={{ background: "var(--red-dim)", border: "1px solid var(--red-glow)", color: "var(--red)" }}
            >
              {error} Your original resume was not changed.
            </div>
            <button
              onClick={handleGenerate}
              className="magnetic-btn px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print-only portal for direct PDF export */}
      {mounted && tailoredResume && createPortal(
        <div className="rd-print-only">
          <ResumeDocument data={tailoredResume} />
        </div>,
        document.body
      )}
    </div>
  );
}
