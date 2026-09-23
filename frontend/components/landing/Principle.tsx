"use client";

/**
 * The product's principle, set large. Words brighten as you scroll through
 * the statement — reading pace and scroll pace match, so it feels like the
 * sentence is being said to you. Fully legible without motion.
 */
import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";

const STATEMENT =
  "Every rewrite is grounded in what you've actually done. Missing requirements stay flagged as gaps — never faked. And you always get the final say.";

export function Principle() {
  const ref = useRef<HTMLElement>(null);

  useGsap(
    ({ reduced, scope }) => {
      if (reduced) return;
      const words = scope.querySelectorAll("[data-word]");
      gsap.fromTo(
        words,
        { opacity: 0.16 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.1,
          scrollTrigger: { trigger: scope.querySelector("p"), start: "top 78%", end: "bottom 45%", scrub: 0.5 },
        }
      );
    },
    [],
    ref
  );

  return (
    <section ref={ref} aria-label="Our principle" className="relative py-24 sm:py-36 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden="true" />
      <div className="container-x relative">
        <p className="eyebrow mb-8">
          <span className="w-4 h-px" style={{ background: "currentColor" }} aria-hidden="true" />
          The rule we don&apos;t break
        </p>
        <p className="display-md max-w-[980px]" style={{ color: "var(--text)" }}>
          {STATEMENT.split(" ").map((w, i) => (
            <span key={i} data-word className={w === "never" || w === "faked." ? "serif-accent" : ""} style={w === "never" || w === "faked." ? { color: "var(--accent-bright)" } : undefined}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
