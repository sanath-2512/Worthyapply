"use client";

import { motion } from "framer-motion";

const phases = [
  { label: "Reading resume", sub: "Extracting text from PDF" },
  { label: "Understanding job requirements", sub: "Structuring the role" },
  { label: "Comparing experience", sub: "Evaluating your match" },
  { label: "Preparing recommendations", sub: "Building optimization plan" },
];

export function Processing() {
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
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Three AI agents working in sequence · ~20 seconds</p>
        </motion.div>

        {/* Phases */}
        <div className="space-y-4">
          {phases.map((phase, i) => (
            <motion.div
              key={phase.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.5, duration: 0.4 }}
              className="flex items-start gap-3"
            >
              <motion.div
                className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                style={{ background: "var(--accent)" }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{phase.label}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{phase.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
