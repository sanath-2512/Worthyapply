"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  onGetStarted: () => void;
}

export function Landing({ onGetStarted }: Props) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const handle = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX - window.innerWidth / 2) / window.innerWidth,
        y: (e.clientY - window.innerHeight / 2) / window.innerHeight,
      });
    };
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[800px] h-[800px] rounded-full opacity-[0.06] blur-[140px]"
          style={{
            background: "var(--accent)",
            left: `calc(40% + ${mouse.x * 25}px)`,
            top: `calc(35% + ${mouse.y * 25}px)`,
            transform: "translate(-50%, -50%)",
            transition: "left 0.7s ease-out, top 0.7s ease-out",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.03] blur-[100px]"
          style={{ background: "#3dd68c", right: "15%", bottom: "25%" }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "radial-gradient(circle, var(--text-muted) 0.5px, transparent 0.5px)",
            backgroundSize: "28px 28px",
            transform: `translate(${mouse.x * 6}px, ${mouse.y * 6}px)`,
            transition: "transform 0.9s ease-out",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 md:px-12 py-6 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--text)" }}>
          WorthyApply
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
          v1.0
        </span>
      </header>

      {/* Main — asymmetric */}
      <main className="relative z-10 flex-1 flex items-center px-6 md:px-12 lg:px-24">
        <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-[1.3fr_1fr] gap-12 lg:gap-20 items-center">
          {/* Left — editorial copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] mb-6" style={{ color: "var(--accent-bright)" }}>
                Application Intelligence
              </p>
              <h1
                className="text-[clamp(2.2rem,6vw,5.5rem)] font-black leading-[0.9] tracking-[-0.03em] mb-6"
                style={{ color: "var(--text)" }}
              >
                Make every
                <br />
                application
                <br />
                <span style={{ color: "var(--accent-bright)" }}>worth submitting.</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-base md:text-lg leading-relaxed max-w-md mb-10"
              style={{ color: "var(--text-secondary)" }}
            >
              Understand the role. Know your fit.
              <br className="hidden sm:block" />
              Strengthen your application.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex items-center gap-6"
            >
              <button
                onClick={onGetStarted}
                className="magnetic-btn group relative inline-flex items-center gap-3 px-8 py-4 text-sm font-semibold rounded-2xl overflow-hidden"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)" }}
                />
                <span className="relative">Get Started</span>
                <span className="relative inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
              </button>
              <span className="text-[11px] hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                Free · No signup
              </span>
            </motion.div>
          </div>

          {/* Right — pipeline visual */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <div
              className="rounded-2xl p-8 border relative"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                transform: `rotateY(${mouse.x * 2}deg) rotateX(${-mouse.y * 2}deg)`,
                transition: "transform 0.5s ease-out",
                boxShadow: "0 40px 80px -20px rgba(0,0,0,0.5)",
              }}
            >
              {/* Pipeline visualization */}
              <div className="space-y-5">
                {[
                  { label: "Resume", icon: "↑", color: "var(--text-secondary)" },
                  { label: "Job Signals", icon: "◎", color: "var(--accent-bright)" },
                  { label: "Match Analysis", icon: "◉", color: "var(--green)" },
                  { label: "Optimization", icon: "✦", color: "var(--amber)" },
                ].map((step, i) => (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.15 }}
                    className="flex items-center gap-4"
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{ background: "var(--surface-elevated)", color: step.color }}
                    >
                      {step.icon}
                    </span>
                    <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                      {step.label}
                    </span>
                    {i < 3 && (
                      <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
                        ↓
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Result preview */}
              <div className="mt-6 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Result
                  </span>
                  <span className="text-lg font-black" style={{ color: "var(--green)" }}>87</span>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full mt-2"
                  style={{ background: "var(--green-dim)", color: "var(--green)" }}
                >
                  ✓ Apply
                </span>
              </div>

              <div
                className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-[50px] opacity-15"
                style={{ background: "var(--accent)" }}
              />
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer steps */}
      <footer className="relative z-10 px-6 md:px-12 py-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex items-center gap-8"
        >
          {["Upload Resume", "Paste Job Description", "Get Intelligence"].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="text-[9px] font-bold tabular-nums" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                0{i + 1}
              </span>
              <span className="text-[11px] hidden sm:inline" style={{ color: "var(--text-muted)" }}>{step}</span>
            </div>
          ))}
        </motion.div>
      </footer>
    </div>
  );
}
