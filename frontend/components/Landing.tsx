"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Icon, type IconName } from "./ui/Icon";
import { ThemeToggle } from "./ui/ThemeToggle";

interface Props {
  onGetStarted: () => void;
}

export function Landing({ onGetStarted }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Parallax is written straight to CSS custom properties and coalesced into one
  // frame per repaint. Routing it through React state instead would re-render
  // this entire page on every pointer move.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let frame = 0;
    const handle = (e: MouseEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = rootRef.current;
        if (!el) return;
        const x = (e.clientX - window.innerWidth / 2) / window.innerWidth;
        const y = (e.clientY - window.innerHeight / 2) / window.innerHeight;
        el.style.setProperty("--mx", String(x));
        el.style.setProperty("--my", String(y));
      });
    };

    window.addEventListener("mousemove", handle, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handle);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ ["--mx" as string]: 0, ["--my" as string]: 0 }}
    >
      {/* Background atmosphere — restrained */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[720px] h-[720px] rounded-full opacity-[0.05] blur-[150px]"
          style={{
            background: "var(--accent)",
            left: "calc(50% + (var(--mx) * 20px))",
            top: "calc(22% + (var(--my) * 20px))",
            transform: "translate(-50%, -50%)",
            transition: "left 0.7s ease-out, top 0.7s ease-out",
          }}
        />
      </div>

      {/* Nav */}
      <header className="relative z-10 px-6 md:px-10 lg:px-16 py-5 flex items-center justify-between border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] font-black"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            W
          </span>
          <span className="text-[14px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
            WorthyApply
          </span>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <button
            onClick={onGetStarted}
            className="text-[13px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            Analyze
          </button>
          <Link
            href="/builder"
            className="text-[13px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            Resume Builder
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <main id="main" tabIndex={-1} className="relative z-10 flex items-center px-6 md:px-10 lg:px-16 py-14 lg:py-20">
        <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 items-center">
          {/* Left — plain-spoken copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <span
                className="inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-full mb-7"
                style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)" }} />
                Reads your resume, not the job board hype
              </span>
              <h1
                className="text-[clamp(2.4rem,5vw,4.1rem)] font-bold leading-[1.04] tracking-[-0.025em] mb-6"
                style={{ color: "var(--text)" }}
              >
                Stop applying blind.
                <br />
                See if you actually fit
                <br />
                <span style={{ color: "var(--accent-bright)" }}>— before you hit send.</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="text-[15px] md:text-base leading-relaxed max-w-lg mb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              Paste a job, drop in your resume, and see exactly where you match.
              Then WorthyApply <span style={{ color: "var(--text)" }} className="font-semibold">automatically tailors it to the job</span> — using
              only what you&apos;ve actually done.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <button
                onClick={onGetStarted}
                className="btn btn-primary btn-lg magnetic-btn group"
              >
                <span>Check my fit</span>
                <span className="inline-flex transition-transform duration-200 group-hover:translate-x-0.5">
                  <Icon name="arrow-right" size={18} />
                </span>
              </button>
              <Link href="/builder" className="btn btn-secondary btn-lg magnetic-btn">
                <Icon name="pencil" size={16} />
                <span>Build a resume instead</span>
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="text-[12px] mt-5"
              style={{ color: "var(--text-muted)" }}
            >
              No account. Nothing uploaded to a server you can&apos;t see. Runs on your job, your words.
            </motion.p>
          </div>

          {/* Right — the actual thing it does: a real bullet rewrite */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-elevated)",
                transform:
                  "perspective(1200px) rotateY(calc(var(--mx) * 1.5deg)) rotateX(calc(var(--my) * -1.5deg))",
                transition: "transform 0.5s ease-out",
              }}
            >
              {/* window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
                <span className="ml-2 text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                  frontend-engineer.jd
                </span>
                <span className="ml-auto text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Fit 62 <span style={{ color: "var(--text-muted)" }}>→</span> <span style={{ color: "var(--green)" }}>88</span>
                </span>
              </div>

              <div className="p-5 space-y-4">
                {/* before */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Your line
                  </span>
                  <p
                    className="mt-1.5 text-[13px] leading-relaxed rounded-lg px-3 py-2"
                    style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}
                  >
                    Built a website using React and APIs.
                  </p>
                </div>

                <div className="flex items-center gap-2 pl-1">
                  <span style={{ color: "var(--accent-bright)" }}><Icon name="sparkle" size={14} /></span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Auto-tailored the instant analysis completes — same facts, sharper
                  </span>
                </div>

                {/* after */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--green)" }}>
                    Tailored automatically
                  </span>
                  <p
                    className="mt-1.5 text-[13px] leading-relaxed rounded-lg px-3 py-2"
                    style={{ background: "var(--green-dim)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}
                  >
                    Developed a React application integrating REST APIs for dynamic data retrieval.
                  </p>
                </div>

                {/* honest gap note */}
                <div className="flex items-start gap-2 pt-1">
                  <span className="mt-0.5 shrink-0" style={{ color: "var(--amber)" }}><Icon name="alert" size={13} /></span>
                  <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    The JD wants Kubernetes and your resume doesn&apos;t show it — so we flag
                    it as a gap and <span style={{ color: "var(--text-secondary)" }}>never</span> pretend you have it.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Automatic tailoring — the headline feature, given its own band */}
      <section className="relative z-10 px-6 md:px-10 lg:px-16 py-16 border-t" style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center"
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--accent-bright)" }}>
                The core feature
              </span>
              <h2 className="text-[clamp(1.8rem,3.2vw,2.6rem)] font-bold tracking-[-0.02em] leading-[1.1] mt-3 mb-5" style={{ color: "var(--text)" }}>
                It tailors your resume automatically — right after the analysis.
              </h2>
              <p className="text-[15px] leading-relaxed mb-5 max-w-xl" style={{ color: "var(--text-secondary)" }}>
                You don&apos;t press a second button or copy suggestions by hand. The moment
                WorthyApply finishes scoring your fit, it rewrites the bullets that matter for
                that specific job and hands you a tailored resume — ready to review, edit, and
                download.
              </p>
              <ul className="space-y-3">
                {[
                  "Every rewrite is grounded in your real experience — nothing fabricated.",
                  "Weak, vague lines become specific, measurable ones aimed at the role.",
                  "Missing requirements stay flagged as gaps instead of being faked.",
                  "The tailored version opens in the editor so you always have the final say.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0" style={{ color: "var(--green)" }}><Icon name="check" size={16} /></span>
                    <span className="text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t}</span>
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="btn btn-primary magnetic-btn mt-8 group">
                See it tailor my resume
                <span className="inline-flex transition-transform duration-200 group-hover:translate-x-0.5">
                  <Icon name="arrow-right" size={16} />
                </span>
              </button>
            </div>

            {/* auto-flow visual */}
            <div
              className="rounded-2xl p-6 md:p-7"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-elevated)" }}
            >
              {([
                { icon: "search", label: "Analyze fit", desc: "Score every requirement against your resume", tone: "var(--accent-bright)" },
                { icon: "sparkle", label: "Auto-tailor", desc: "Rewrite the weak bullets for this job — instantly, no extra click", tone: "var(--green)" },
                { icon: "pencil", label: "Edit & export", desc: "Open in the editor, adjust, download a clean PDF", tone: "var(--text-secondary)" },
              ] as { icon: IconName; label: string; desc: string; tone: string }[]).map((step, i, arr) => (
                <div key={step.label}>
                  <div className="flex items-start gap-3.5">
                    <span
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                      style={{ background: "var(--surface-elevated)", color: step.tone, border: "1px solid var(--border-subtle)" }}
                    >
                      <Icon name={step.icon} size={17} />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>{step.label}</p>
                      <p className="text-[12.5px] leading-relaxed mt-0.5" style={{ color: "var(--text-muted)" }}>{step.desc}</p>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="ml-[17px] my-2 h-6 w-px" style={{ background: "var(--border)" }} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Everything WorthyApply does */}
      <section className="relative z-10 px-6 md:px-10 lg:px-16 py-16 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-10">
            <h2 className="text-[clamp(1.7rem,3vw,2.3rem)] font-bold tracking-[-0.02em] mb-3" style={{ color: "var(--text)" }}>
              Everything you need to apply with confidence
            </h2>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              From reading a job you&apos;re unsure about to sending a resume that fits it —
              WorthyApply covers the whole loop, and builds one from scratch if you don&apos;t have one yet.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden" style={{ background: "var(--border-subtle)" }}>
            {([
              { icon: "search", title: "Honest fit analysis", body: "Each requirement checked against real evidence — matched, partial, or missing. An explainable score, not a black box." },
              { icon: "sparkle", title: "Automatic tailoring", body: "The instant analysis ends, your bullets are rewritten for the job using only what you've actually done." },
              { icon: "pencil", title: "Full resume editor", body: "The tailored resume opens in an editor. Change anything, then export a clean one-page PDF." },
              { icon: "file-plus", title: "Build from scratch", body: "No resume yet? Start blank in the builder, add your sections, and export a polished PDF." },
            ] as { icon: IconName; title: string; body: string }[]).map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="p-6 md:p-7"
                style={{ background: "var(--surface)" }}
              >
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
                  style={{ background: "var(--surface-elevated)", color: "var(--accent-bright)", border: "1px solid var(--border-subtle)" }}
                >
                  <Icon name={f.icon} size={18} />
                </span>
                <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>{f.title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it actually works — three honest steps */}
      <section className="relative z-10 px-6 md:px-10 lg:px-16 py-16 border-t" style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[clamp(1.7rem,3vw,2.3rem)] font-bold tracking-[-0.02em] mb-10 max-w-2xl" style={{ color: "var(--text)" }}>
            Three steps, and only one of them is on you
          </h2>
          <div className="grid md:grid-cols-3 gap-px rounded-2xl overflow-hidden" style={{ background: "var(--border-subtle)" }}>
            {[
              {
                n: "01",
                title: "You paste the job + resume",
                body: "Drop in a job description and your resume. That's the only manual step — the rest runs on its own.",
              },
              {
                n: "02",
                title: "It scores, then tailors — automatically",
                body: "Requirements are matched against your evidence, and the moment that's done your resume is rewritten to fit the role. Nothing invented.",
              },
              {
                n: "03",
                title: "You edit and export",
                body: "The tailored resume opens in a full editor. Change anything, then download a clean one-page PDF ready to send.",
              },
            ].map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="p-7 md:p-8"
                style={{ background: "var(--bg)" }}
              >
                <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--accent-bright)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {s.n}
                </span>
                <h3 className="text-[16px] font-semibold mt-3 mb-2" style={{ color: "var(--text)" }}>
                  {s.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {s.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Resume builder showcase */}
      <section className="relative z-10 px-6 md:px-10 lg:px-16 py-16 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--accent-bright)" }}>
              No resume yet? Start here
            </span>
            <h2 className="text-[clamp(1.7rem,3vw,2.3rem)] font-bold tracking-[-0.02em] leading-[1.1] mt-3 mb-4" style={{ color: "var(--text)" }}>
              A full resume builder, from a blank page to a clean PDF
            </h2>
            <p className="text-[15px] leading-relaxed mb-6 max-w-lg" style={{ color: "var(--text-secondary)" }}>
              Build a resume section by section in a live editor — experience, skills, projects,
              education — and export a polished, one-page PDF. Or import an existing file, then let
              the analyzer tailor it to a specific job.
            </p>
            <Link href="/builder" className="btn btn-secondary btn-lg magnetic-btn">
              <Icon name="pencil" size={16} />
              <span>Open the resume builder</span>
            </Link>
          </div>

          {/* builder mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-elevated)" }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
              <span className="ml-2 text-[11px]" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                resume-builder
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <div className="h-3 w-40 rounded" style={{ background: "var(--text)" }} />
                <div className="h-2 w-56 rounded" style={{ background: "var(--border)" }} />
              </div>
              {["Experience", "Skills", "Projects"].map((sec) => (
                <div key={sec} className="rounded-lg p-3.5" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span style={{ color: "var(--accent-bright)" }}><Icon name="check" size={13} /></span>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>{sec}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 w-full rounded" style={{ background: "var(--border)" }} />
                    <div className="h-2 w-4/5 rounded" style={{ background: "var(--border)" }} />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>One page · ready to export</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
                  <Icon name="download" size={12} /> PDF
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative z-10 px-6 md:px-10 lg:px-16 py-20 border-t" style={{ borderColor: "var(--border-subtle)", background: "var(--surface)" }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-[clamp(1.9rem,3.6vw,2.9rem)] font-bold tracking-[-0.02em] leading-[1.08] mb-4" style={{ color: "var(--text)" }}>
            Send five sharp applications, not fifty generic ones.
          </h2>
          <p className="text-[15px] md:text-base leading-relaxed mb-8 max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Check your fit, let WorthyApply tailor your resume automatically, and apply knowing
            it actually matches the job. Built on your words — never invented ones.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={onGetStarted} className="btn btn-primary btn-lg magnetic-btn group">
              <span>Check my fit</span>
              <span className="inline-flex transition-transform duration-200 group-hover:translate-x-0.5">
                <Icon name="arrow-right" size={18} />
              </span>
            </button>
            <Link href="/builder" className="btn btn-secondary btn-lg magnetic-btn">
              <Icon name="pencil" size={16} />
              <span>Build a resume instead</span>
            </Link>
          </div>
          <p className="text-[12px] mt-6" style={{ color: "var(--text-muted)" }}>
            No account. Runs on your job, your words.
          </p>
        </motion.div>
      </section>
    </div>
  );
}
