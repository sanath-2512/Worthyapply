"use client";

/**
 * Heading whose lines rise out of a mask, word by word. Uses GSAP SplitText
 * with `autoSplit`, so lines re-split correctly when the viewport (and so the
 * line breaks) change. Screen readers get the original text: SplitText sets
 * aria-label on the element and hides the generated spans.
 */
import { useRef } from "react";
import { gsap, SplitText, useGsap } from "@/lib/motion";

interface Props {
  as?: "h1" | "h2" | "h3" | "p";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  /** Play on mount (hero) or when scrolled into view. */
  trigger?: "mount" | "scroll";
  id?: string;
}

export function SplitHeading({ as: Tag = "h2", children, className = "", style, delay = 0, trigger = "scroll", id }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGsap(
    ({ reduced, scope }) => {
      if (reduced) return;
      let split: SplitText | null = null;
      // Wait for webfonts so line breaks are measured with the real metrics.
      const run = () => {
        split = SplitText.create(scope, {
          type: "lines,words",
          linesClass: "split-line",
          autoSplit: true,
          aria: "auto",
          onSplit(self) {
            return gsap.from(self.words, {
              yPercent: 110,
              opacity: 0,
              duration: 1.1,
              ease: "expo.out",
              stagger: 0.035,
              delay,
              scrollTrigger: trigger === "scroll" ? { trigger: scope, start: "top 85%", once: true } : undefined,
            });
          },
        });
      };
      // Keep the heading hidden only for the brief font wait, never longer.
      gsap.set(scope, { autoAlpha: 0 });
      let cancelled = false;
      document.fonts.ready.then(() => {
        if (cancelled) return;
        gsap.set(scope, { autoAlpha: 1 });
        run();
      });
      return () => {
        cancelled = true;
        split?.revert();
      };
    },
    [delay, trigger],
    ref
  );

  return (
    <Tag ref={ref} className={className} style={style} id={id}>
      {children}
    </Tag>
  );
}
