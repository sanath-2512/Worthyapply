"use client";

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

interface Props {
  agents?: AgentUiState[];
  /** Live token text for the currently running agent, keyed by agent id. */
  liveText?: Partial<Record<AgentId, string>>;
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

export function Processing({ agents = INITIAL_AGENTS, liveText = {} }: Props) {
  const completed = agents.filter((a) => a.status === "completed").length;
  const total = agents.length;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative">
      <motion.div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
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
              style={{ border: "1.5px solid var(--accent)", borderRightColor: "transparent", borderBottomColor: "transparent" }}
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

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-center mb-10">
          <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>Analyzing your application</h2>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }} aria-live="polite">
            {completed} of {total} steps complete
          </p>
        </motion.div>

        {/* Live agent phases */}
        <div className="space-y-4" role="list" aria-label="Analysis progress">
          {agents.map((agent) => {
            const isActive = agent.status === "running";
            const isDone = agent.status === "completed";
            const isError = agent.status === "error";
            const textColor = isError
              ? "var(--red)"
              : isDone
              ? "var(--text-secondary)"
              : isActive
              ? "var(--text)"
              : "var(--text-muted)";
            return (
              <motion.div
                key={agent.id}
                role="listitem"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35 }}
                className="flex items-start gap-3"
              >
                <StatusMark status={agent.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: textColor }}>
                    {agent.label}
                  </p>
                  {(isActive || isError) && agent.message && (
                    <p className="text-[11px]" style={{ color: isError ? "var(--red)" : "var(--text-muted)" }}>
                      {agent.message}
                    </p>
                  )}
                  {isActive && liveText[agent.id] && (
                    <div
                      className="mt-2 rounded-lg px-3 py-2 max-h-24 overflow-hidden text-[10.5px] leading-relaxed font-mono whitespace-pre-wrap break-words"
                      style={{
                        background: "var(--surface)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-subtle)",
                      }}
                      aria-live="polite"
                    >
                      {/* Show only the streaming tail so the box stays put. */}
                      {liveText[agent.id]!.slice(-320)}
                      <span className="inline-block w-1.5 h-3 ml-0.5 align-middle animate-pulse" style={{ background: "var(--accent)" }} />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
