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
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { StreamConsole } from "@/components/ui/StreamConsole";

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

  const cancelTailoring = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
  };

  return (
    <div className="card-elevated relative overflow-hidden">
      <div
        className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl opacity-70 pointer-events-none"
        style={{ background: "var(--accent-dim)" }}
        aria-hidden="true"
      />
      <div className="relative p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-accent)" }}>
            <Icon name="sparkle" size={20} />
          </span>
          <div className="min-w-0">
            <p className="eyebrow mb-1">Tailor</p>
            <h2 className="heading" style={{ color: "var(--text)" }}>
              Generate Tailored Resume
            </h2>
            <p className="text-[14px] mt-2 leading-relaxed max-w-2xl" style={{ color: "var(--text-secondary)" }}>
              Apply the recommendations above to your existing resume. You&apos;ll review and
              edit everything in the resume editor before exporting — nothing is final.
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="mt-7">
              <ul className="grid sm:grid-cols-3 gap-3 mb-7">
                {[
                  { icon: "zap" as const, t: "Rewrites bullets for this role" },
                  { icon: "check" as const, t: "Adds the matching skills" },
                  { icon: "pencil" as const, t: "Opens in the editor for review" },
                ].map((r) => (
                  <li key={r.t} className="flex items-center gap-2.5 p-3 rounded-xl text-[13px]" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--accent-bright)" }}><Icon name={r.icon} size={14} /></span>
                    {r.t}
                  </li>
                ))}
              </ul>
              {!canRun && (
                <p className="text-[12.5px] mb-4 flex items-start gap-2 p-3 rounded-xl" style={{ color: "var(--amber)", background: "var(--amber-dim)" }}>
                  <span className="mt-0.5 shrink-0"><Icon name="alert" size={13} /></span>
                  The original resume/JD from this session is needed to tailor. Start a new
                  analysis if this message persists.
                </p>
              )}
              <Button size="lg" magnetic onClick={handleGenerate} disabled={!canRun} iconLeft="sparkle" iconRight="arrow-right">
                Generate Tailored Resume
              </Button>
            </motion.div>
          )}

          {phase === "tailoring" && (
            <motion.div key="tailoring" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="mt-7 grid md:grid-cols-[1fr_220px] gap-5 items-start">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="spinner" style={{ width: 16, height: 16, color: "var(--accent-bright)" }} aria-hidden="true" />
                  <span className="text-[14px] font-medium" style={{ color: "var(--text)" }} aria-live="polite">
                    {statusMsg}
                  </span>
                </div>
                <StreamConsole text={liveText} label="tailoring" tail={600} maxHeight="10rem" />
                {!liveText && (
                  <div className="space-y-2.5 p-4 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }} aria-hidden="true">
                    <div className="skeleton h-2.5 w-3/4" />
                    <div className="skeleton h-2.5 w-full" />
                    <div className="skeleton h-2.5 w-5/6" />
                  </div>
                )}
                <Button variant="ghost" size="sm" className="mt-4" onClick={cancelTailoring}>
                  Cancel
                </Button>
              </div>
              {/* The document taking shape */}
              <div className="hidden md:block rounded-lg p-4 space-y-2.5" style={{ background: "#fff", aspectRatio: "210 / 297", boxShadow: "var(--viewer-shadow)" }} aria-hidden="true">
                <div className="skeleton h-3 w-2/3 !bg-[#e9e9ef]" />
                <div className="skeleton h-1.5 w-5/6 !bg-[#f0f0f4]" />
                {[0, 1, 2, 3].map((k) => (
                  <div key={k} className="space-y-1.5 pt-2">
                    <div className="skeleton h-2 w-1/3 !bg-[#e4e4ea]" />
                    <div className="skeleton h-1.5 w-full !bg-[#f0f0f4]" />
                    <div className="skeleton h-1.5 w-11/12 !bg-[#f0f0f4]" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="mt-7 space-y-5">
              {/* Header & Main Actions */}
              <div
                className="rounded-2xl p-5 sm:p-6 border"
                style={{ background: "linear-gradient(120deg, var(--green-dim) 0%, var(--accent-dim) 100%)", borderColor: "var(--green-glow)" }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[12px] font-semibold mb-2.5" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
                      <Icon name="check" size={12} strokeWidth={2.5} />
                      <span>Tailored Resume Ready</span>
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                      Customized for {data.job_analysis.job_title}
                    </h3>
                    <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
                      {implementedCount} key optimization{implementedCount === 1 ? "" : "s"} applied directly to your experience &amp; skills.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                    <Button size="sm" onClick={handleDownloadPdf} iconLeft="download">
                      Download PDF
                    </Button>
                    <Button variant="secondary" size="sm" onClick={goToEditor} iconLeft="pencil" iconRight="arrow-right">
                      Open Editor
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleGenerate} iconLeft="refresh" title="Regenerate with fresh AI tailoring" className="col-span-2">
                      Regenerate
                    </Button>
                  </div>
                </div>
              </div>

              {/* Added Skills & Recommendations Notice Banner */}
              <div className="rounded-2xl p-5 sm:p-6 border" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                <div className="flex items-start gap-3.5">
                  <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)", color: "var(--accent-bright)" }}>
                    <Icon name="sparkle" size={17} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[14px] font-semibold mb-1" style={{ color: "var(--text)" }}>
                      Recommendations &amp; skills added directly
                    </h4>
                    <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
                      All recommendations and target skills for this job were added directly into your tailored resume.{" "}
                      <span className="font-medium" style={{ color: "var(--accent-bright)" }}>
                        If you don&apos;t have any of these in your tech stack, you can easily remove or adjust them in the editor.
                      </span>
                    </p>
                    {addedSkills.length > 0 && (
                      <div className="mb-4">
                        <span className="text-[11px] font-mono uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                          Added skills &amp; technologies
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {addedSkills.map((s) => (
                            <span key={s} className="chip">
                              <Icon name="check" size={11} strokeWidth={2.5} style={{ color: "var(--green)" }} /> {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button variant="secondary" size="xs" onClick={goToEditor} iconLeft="pencil">
                      Review / Remove in Editor
                    </Button>
                  </div>
                </div>
              </div>

              {/* View Selector Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs<ViewTab>
                  label="Tailored resume view"
                  size="sm"
                  value={viewTab}
                  onChange={setViewTab}
                  panelIdPrefix="tailor-panel"
                  items={[
                    { id: "preview", label: "Document preview", icon: "document" },
                    { id: "changes", label: `Applied changes (${implementedCount})`, icon: "zap" },
                  ]}
                />

                {viewTab === "preview" && (
                  <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <button
                      onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                      className="icon-btn !min-w-8 !min-h-8 text-sm"
                      style={{ color: "var(--text-secondary)" }}
                      aria-label="Zoom out"
                    >
                      −
                    </button>
                    <span className="text-[11px] font-mono tabular w-11 text-center" style={{ color: "var(--text-muted)" }} aria-live="polite">
                      {Math.round(effectiveScale * 100)}%
                    </span>
                    <button
                      onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                      className="icon-btn !min-w-8 !min-h-8 text-sm"
                      style={{ color: "var(--text-secondary)" }}
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* Tab 1: Document Preview */}
              {viewTab === "preview" && tailoredResume && (
                <div
                  ref={previewContainerRef}
                  id="tailor-panel-preview"
                  role="tabpanel"
                  data-lenis-prevent
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
                <ul id="tailor-panel-changes" role="tabpanel" className="space-y-2.5">
                  {recommendations.length > 0 ? (
                    recommendations.map((rec, i) => {
                      const done = rec.status === "implemented";
                      return (
                        <motion.li
                          key={rec.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className="p-4 rounded-xl border flex items-start gap-3 text-[13px]"
                          style={{
                            background: done ? "var(--surface)" : "var(--bg-elevated)",
                            borderColor: done ? "var(--green-glow)" : "var(--border-subtle)",
                          }}
                        >
                          <span
                            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{
                              background: done ? "var(--green-dim)" : "var(--amber-dim)",
                              color: done ? "var(--green)" : "var(--amber)",
                            }}
                          >
                            {done ? <Icon name="check" size={12} strokeWidth={2.5} /> : <Icon name="alert" size={12} />}
                          </span>
                          <div className="space-y-1 min-w-0">
                            <p className="font-medium" style={{ color: "var(--text)" }}>
                              {rec.recommendation}
                            </p>
                            {done && rec.change && (
                              <p style={{ color: "var(--text-secondary)" }}>
                                <span className="font-semibold text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--green)" }}>Applied · </span>
                                {rec.change}
                              </p>
                            )}
                            {!done && rec.reason && (
                              <p style={{ color: "var(--amber)" }}>
                                <span className="font-semibold text-[11px] font-mono uppercase tracking-wider">Note · </span>
                                {rec.reason}
                              </p>
                            )}
                          </div>
                        </motion.li>
                      );
                    })
                  ) : changes.length > 0 ? (
                    changes.map((c, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="p-4 rounded-xl border flex items-start gap-3 text-[13px]"
                        style={{ background: "var(--surface)", borderColor: "var(--green-glow)" }}
                      >
                        <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
                          <Icon name="check" size={12} strokeWidth={2.5} />
                        </span>
                        <div>
                          <span className="font-semibold uppercase tracking-wider text-[11px] font-mono" style={{ color: "var(--green)" }}>
                            {c.section}:{" "}
                          </span>
                          <span style={{ color: "var(--text-secondary)" }}>{c.description}</span>
                        </div>
                      </motion.li>
                    ))
                  ) : (
                    <li className="text-[13px] text-center py-8 rounded-xl border border-dashed" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                      No specific changes recorded.
                    </li>
                  )}
                </ul>
              )}
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-7">
              <div
                role="alert"
                className="rounded-2xl p-4 mb-4 flex items-start gap-3"
                style={{ background: "var(--red-dim)", border: "1px solid var(--red-glow)" }}
              >
                <span className="mt-0.5 shrink-0" style={{ color: "var(--red)" }}><Icon name="alert" size={16} /></span>
                <div>
                  <p className="text-[14px] font-medium" style={{ color: "var(--text)" }}>Tailoring didn&apos;t finish</p>
                  <p className="text-[13px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {error} Your original resume was not changed.
                  </p>
                </div>
              </div>
              <Button onClick={handleGenerate} iconLeft="refresh">
                Retry
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
