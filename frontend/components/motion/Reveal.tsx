"use client";

/**
 * Scroll-triggered reveal. The element (or, with `stagger`, each descendant
 * marked `data-reveal`) rises and un-blurs once as it enters the viewport.
 *
 * Content is visible by default in the markup; GSAP only hides it at mount
 * time on the client. So with JS disabled, reduced motion, or a failed
 * script, nothing is ever stuck invisible.
 */
import { useRef } from "react";
import { gsap, useGsap } from "@/lib/motion";

interface Props {
  children: React.ReactNode;
  className?: string;
  /** Stagger direct `[data-reveal]` descendants instead of the whole block. */
  stagger?: number;
  y?: number;
  delay?: number;
  /** ScrollTrigger start, e.g. "top 85%". */
  start?: string;
  as?: "div" | "section" | "ul" | "ol";
  id?: string;
}

export function Reveal({ children, className = "", stagger, y = 28, delay = 0, start = "top 86%", as: Tag = "div", id }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGsap(
    ({ reduced, scope }) => {
      if (reduced) return;
      const targets = stagger ? scope.querySelectorAll<HTMLElement>("[data-reveal]") : [scope];
      if (!targets.length) return;
      gsap.fromTo(
        targets,
        { autoAlpha: 0, y, filter: "blur(6px)" },
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 1,
          delay,
          ease: "expo.out",
          stagger: stagger ?? 0,
          clearProps: "filter",
          scrollTrigger: { trigger: scope, start, once: true },
        }
      );
    },
    [stagger, y, delay, start],
    ref
  );

  return (
    <Tag ref={ref as React.Ref<HTMLDivElement & HTMLUListElement & HTMLOListElement>} className={className} id={id}>
      {children}
    </Tag>
  );
}
