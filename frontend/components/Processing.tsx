"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { AgentId } from "@/lib/api";
import { Icon } from "./ui/Icon";

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

function StatusMark({ status }: { status: AgentStatus }) {
  if (status === "completed") {
    return (
      <span
        className="mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
        style={{ background: "var(--green-dim)", color: "var(--green)" }}
        aria-hidden="true"
      >
        <Icon name="check" size={11} strokeWidth={2.5} />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
        style={{ background: "var(--red-dim)", color: "var(--red)" }}
        aria-hidden="true"
      >
        <Icon name="x" size={11} strokeWidth={2.5} />
      </span>
    );
  }
  if (status === "running") {
    return (
      <motion.span
        className="mt-1 w-2 h-2 rounded-full shrink-0"
        style={{ background: "var(--accent)" }}
        animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
    );
  }
  // pending
  return (
    <span
      className="mt-1 w-2 h-2 rounded-full shrink-0"
      style={{ border: "1.5px solid var(--border)" }}
      aria-hidden="true"
    />
  );
}

function statusColor(status: AgentStatus) {
  if (status === "error") return "var(--red)";
  if (status === "completed") return "var(--text-secondary)";
  if (status === "running") return "var(--text)";
  return "var(--text-muted)";
}

function Step({
  agent,
  live,
}: {
  agent: AgentUiState;
  live?: string;
}) {
  const isActive = agent.status === "running";
  const isError = agent.status === "error";
  return (
    <motion.div
      role="listitem"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-start gap-3"
    >
      <StatusMark status={agent.status} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: statusColor(agent.status) }}>
          {agent.label}
        </p>
        {(isActive || isError) && agent.message && (
          <p className="text-[11px]" style={{ color: isError ? "var(--red)" : "var(--text-muted)" }}>
            {agent.message}
          </p>
        )}
        {isActive && live && (
          <div
            className="mt-2 rounded-lg px-3 py-2 max-h-24 overflow-hidden text-[10.5px] leading-relaxed font-mono whitespace-pre-wrap break-words"
            style={{
              background: "var(--surface)",
              color: "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Show only the streaming tail so the box stays put. */}
            {live.slice(-320)}
            <span
              className="inline-block w-1.5 h-3 ml-0.5 align-middle animate-pulse"
              style={{ background: "var(--accent)" }}
            />
          </div>
        )}
      </div>
    </motion.div>
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

export function Processing({
  agents = INITIAL_AGENTS,
  liveText = {},
  analysisMessage = "",
  onCancel,
}: Props) {
  const elapsed = useElapsedSeconds();

  const completed = agents.filter((a) => a.status === "completed").length;
  const total = agents.length;

  const leadSteps = agents.filter((a) => !ANALYSIS_IDS.includes(a.id));
  const analysisSteps = agents.filter((a) => ANALYSIS_IDS.includes(a.id));
  const analysisRunning = analysisSteps.some((a) => a.status === "running");
  const analysisErrored = analysisSteps.some((a) => a.status === "error");

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 relative">
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-hidden="true"
      >
        <motion.div
          className="w-[350px] h-[350px] rounded-full blur-[120px] opacity-[0.05]"
          style={{ background: "var(--accent)" }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Orbital */}
        <div className="flex justify-center mb-12">
          <div className="relative w-20 h-20">
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: "1px solid var(--border)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-2 rounded-full"
              style={{
                border: "1.5px solid var(--accent)",
                borderRightColor: "transparent",
                borderBottomColor: "transparent",
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "var(--accent)" }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-10"
        >
          <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>
            Analyzing your application
          </h2>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }} aria-live="polite">
            {completed} of {total} steps complete
            <span aria-hidden="true"> · {elapsed}s</span>
          </p>
        </motion.div>

        {/* Live phases */}
        <div className="space-y-4" role="list" aria-label="Analysis progress">
          {leadSteps.map((agent) => (
            <Step key={agent.id} agent={agent} live={liveText[agent.id]} />
          ))}

          {analysisSteps.map((agent) => (
            <Step key={agent.id} agent={agent} live={liveText[agent.id]} />
          ))}
        </div>

        {/* One shared status line: the three phases above run in a single model
            call, so this describes what that call is working through. */}
        {analysisRunning && analysisMessage && (
          <p
            className="mt-5 text-[11px] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
            aria-live="polite"
          >
            {analysisMessage}
          </p>
        )}

        {!analysisErrored && (
          <p className="mt-6 text-[10.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            This usually takes 15–40 seconds. Keep this tab open.
          </p>
        )}

        {onCancel && (
          <div className="mt-6">
            <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
