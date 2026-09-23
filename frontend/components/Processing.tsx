"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AgentId } from "@/lib/api";
import { Icon } from "./ui/Icon";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";
import { StreamConsole } from "./ui/StreamConsole";
import { SignalScene } from "./three/SignalScene";
import { createDriver, type SceneDriver } from "./three/driver";

export type AgentStatus = "pending" | "running" | "completed" | "error";

export interface AgentUiState {
  id: AgentId;
  label: string;
  status: AgentStatus;
  message?: string;
}

// Display order + human labels. Mirrors the backend pipeline order.
export const INITIAL_AGENTS: AgentUiState[] = [
  { id: "resume_analyzer", label: "Reading resume", status: "pending" },
  { id: "job_analyzer", label: "Understanding job requirements", status: "pending" },
  { id: "matcher", label: "Comparing your experience", status: "pending" },
  { id: "resume_optimizer", label: "Preparing recommendations", status: "pending" },
];

// The last three run inside ONE model call, so they share a status line.
const ANALYSIS_IDS: AgentId[] = ["job_analyzer", "matcher", "resume_optimizer"];

interface Props {
  agents?: AgentUiState[];
  /** Live token text for the currently running agent, keyed by agent id. */
  liveText?: Partial<Record<AgentId, string>>;
  /** Shared status line for the combined analysis call. */
  analysisMessage?: string;
  onCancel?: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

function StatusMark({ status }: { status: AgentStatus }) {
  const base = "relative z-10 w-6 h-6 rounded-full shrink-0 flex items-center justify-center transition-colors duration-300";
  if (status === "completed") {
    return (
      <motion.span
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className={base}
        style={{ background: "var(--green)", color: "var(--bg)" }}
        aria-hidden="true"
      >
        <Icon name="check" size={12} strokeWidth={3} />
      </motion.span>
    );
  }
  if (status === "error") {
    return (
      <span className={base} style={{ background: "var(--red)", color: "#fff" }} aria-hidden="true">
        <Icon name="x" size={12} strokeWidth={3} />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className={base} style={{ background: "var(--accent-dim)", color: "var(--accent-bright)", boxShadow: "0 0 0 1px var(--accent-glow)" }} aria-hidden="true">
        <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
      </span>
    );
  }
  return (
    <span className={base} style={{ background: "var(--surface)", border: "1px solid var(--border)" }} aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--border-strong)" }} />
    </span>
  );
}

function statusColor(status: AgentStatus) {
  if (status === "error") return "var(--red)";
  if (status === "completed") return "var(--text-secondary)";
  if (status === "running") return "var(--text)";
  return "var(--text-muted)";
}

const STATUS_TEXT: Record<AgentStatus, string> = {
  pending: "waiting",
  running: "in progress",
  completed: "done",
  error: "failed",
};

function Step({ agent, last }: { agent: AgentUiState; last: boolean }) {
  const isActive = agent.status === "running";
  const isError = agent.status === "error";
  return (
    <li className="relative flex items-start gap-3.5 pb-5 last:pb-0">
      {/* Connector to the next step fills in once this one completes. */}
      {!last && (
        <span className="absolute left-[11.5px] top-7 bottom-1 w-px" style={{ background: "var(--border)" }} aria-hidden="true">
          <motion.span
            className="absolute inset-x-0 top-0"
            style={{ background: "var(--green)" }}
            initial={false}
            animate={{ height: agent.status === "completed" ? "100%" : "0%" }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        </span>
      )}
      <StatusMark status={agent.status} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[14px] font-medium transition-colors duration-300" style={{ color: statusColor(agent.status) }}>
          {agent.label}
          <span className="sr-only"> — {STATUS_TEXT[agent.status]}</span>
        </p>
        <AnimatePresence initial={false}>
          {(isActive || isError) && agent.message && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[12px] mt-0.5 overflow-hidden"
              style={{ color: isError ? "var(--red)" : "var(--text-muted)" }}
            >
              {agent.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

/** Whole seconds since mount — gives an honest sense of duration on a long wait. */
function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}

function formatElapsed(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function Processing({
  agents = INITIAL_AGENTS,
  liveText = {},
  analysisMessage = "",
  onCancel,
}: Props) {
  const elapsed = useElapsedSeconds();
  const driver = useRef<SceneDriver>(createDriver({ progress: 0.04, energy: 1 }));

  const completed = agents.filter((a) => a.status === "completed").length;
  const total = agents.length;

  const leadSteps = agents.filter((a) => !ANALYSIS_IDS.includes(a.id));
  const analysisSteps = agents.filter((a) => ANALYSIS_IDS.includes(a.id));
  const analysisRunning = analysisSteps.some((a) => a.status === "running");
  const analysisErrored = analysisSteps.some((a) => a.status === "error");
  const anyError = agents.some((a) => a.status === "error");
  const ordered = [...leadSteps, ...analysisSteps];

  // The field behind the card assembles as real pipeline steps complete.
  useEffect(() => {
    driver.current.progress = 0.08 + 0.92 * (completed / Math.max(total, 1));
    driver.current.energy = anyError ? 0.1 : 1;
  }, [completed, total, anyError]);

  // Stream tail from whichever agent is producing tokens right now.
  const running = agents.find((a) => a.status === "running");
  const live = (running && liveText[running.id]) || Object.values(liveText).filter(Boolean).pop() || "";

  const pct = Math.round((completed / Math.max(total, 1)) * 100);

  return (
    <div className="min-h-[100svh] relative flex flex-col overflow-hidden">
      <SignalScene driver={driver} className="absolute inset-0" interactive={false} />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ background: "radial-gradient(ellipse 60% 55% at 50% 50%, color-mix(in srgb, var(--bg) 55%, transparent) 0%, transparent 70%), linear-gradient(0deg, var(--bg) 0%, transparent 30%)" }}
      />

      <header className="relative z-10 px-[var(--gutter)] h-[var(--header-h)] flex items-center justify-between">
        <Logo size={26} />
        <span className="inline-flex items-center gap-2 text-[12px] font-mono tabular" style={{ color: "var(--text-muted)" }}>
          <span className="status-dot" data-pulse={!anyError} style={{ color: anyError ? "var(--red)" : "var(--accent)", width: 6, height: 6 }} />
          <span aria-hidden="true">{formatElapsed(elapsed)}</span>
        </span>
      </header>

      <main id="main" tabIndex={-1} className="relative z-10 flex-1 flex items-center justify-center px-[var(--gutter)] py-10 outline-none">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="w-full max-w-[440px] glass rounded-3xl p-6 sm:p-8"
          style={{ boxShadow: "var(--shadow-pop)" }}
        >
          <p className="eyebrow mb-3">
            <span className="w-4 h-px" style={{ background: "currentColor" }} aria-hidden="true" />
            {anyError ? "Stopped" : "Analyzing"}
          </p>
          <h1 className="heading" style={{ color: "var(--text)" }}>
            {anyError ? "Something went wrong" : "Reading your fit"}
          </h1>
          <p className="text-[13px] mt-2" style={{ color: "var(--text-muted)" }} aria-live="polite">
            {completed} of {total} steps complete
          </p>

          {/* Overall progress */}
          <div
            className="mt-5 h-1 rounded-full overflow-hidden"
            style={{ background: "var(--surface-elevated)" }}
            role="progressbar"
            aria-label="Analysis progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <motion.div
              className="h-full rounded-full relative overflow-hidden"
              style={{ background: anyError ? "var(--red)" : "linear-gradient(90deg, var(--accent), var(--accent-2))" }}
              initial={{ width: "4%" }}
              animate={{ width: `${Math.max(4, pct)}%` }}
              transition={{ duration: 0.8, ease: EASE }}
            />
          </div>

          <ol className="mt-7" aria-label="Analysis steps">
            {ordered.map((agent, i) => (
              <Step key={agent.id} agent={agent} last={i === ordered.length - 1} />
            ))}
          </ol>

          {/* One shared status line: the three phases above run in a single model
              call, so this describes what that call is working through. */}
          <AnimatePresence>
            {analysisRunning && analysisMessage && (
              <motion.p
                key={analysisMessage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 text-[12.5px] leading-relaxed flex items-center gap-2"
                style={{ color: "var(--text-secondary)" }}
                aria-live="polite"
              >
                <Icon name="sparkle" size={13} style={{ color: "var(--accent-bright)" }} />
                {analysisMessage}
              </motion.p>
            )}
          </AnimatePresence>

          <StreamConsole text={live} className="mt-5" maxHeight="6.5rem" />

          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {analysisErrored ? "Returning you to your inputs…" : "Usually 15–40 seconds. Keep this tab open."}
            </p>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
