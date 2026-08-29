"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ResumeData } from "@/lib/resume-types";
import { ResumeDocument } from "./ResumeDocument";

interface Props {
  data: ResumeData;
}

const A4_WIDTH_PX = 794; // 210mm @96dpi
const A4_HEIGHT_PX = 1123; // 297mm @96dpi

export function ResumePreview({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [overflow, setOverflow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleDownload = () => {
    // Native print → "Save as PDF". Produces a small (~50KB) text-based PDF
    // with selectable text (re-extractable) and clickable links.
    window.print();
  };

  // Fit-to-width scaling
  useEffect(() => {
    const compute = () => {
      if (!containerRef.current) return;
      const available = containerRef.current.clientWidth - 48;
      setScale(Math.min(available / A4_WIDTH_PX, 1));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Overflow detection
  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollHeight > A4_HEIGHT_PX + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  const effectiveScale = scale * zoom;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
            Worthy Classic
          </span>
          {overflow && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-md" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>
              <span>⚠</span> Resume exceeds one page
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "var(--surface)" }}>
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)" }} aria-label="Zoom out">−</button>
            <span className="text-[10px] tabular-nums w-9 text-center" style={{ color: "var(--text-muted)" }}>{Math.round(effectiveScale * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)" }} aria-label="Zoom in">+</button>
          </div>

          <button
            onClick={handleDownload}
            disabled={!data.personal.fullName}
            className="magnetic-btn text-sm font-semibold px-5 py-2 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 4px 16px rgba(108,99,255,0.2)" }}
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* On-screen scaled preview */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto rounded-xl p-6 flex justify-center"
        style={{ background: "#3a3a42" }}
      >
        <div
          style={{
            width: A4_WIDTH_PX * effectiveScale,
            height: docRef.current ? docRef.current.scrollHeight * effectiveScale : A4_HEIGHT_PX * effectiveScale,
          }}
        >
          <div
            ref={docRef}
            style={{
              transform: `scale(${effectiveScale})`,
              transformOrigin: "top left",
              width: A4_WIDTH_PX,
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            }}
          >
            <ResumeDocument data={data} />
          </div>
        </div>
      </div>

      {/* Print-only copy — portaled to body. Only this shows when printing. */}
      {mounted && createPortal(
        <div className="rd-print-only">
          <ResumeDocument data={data} />
        </div>,
        document.body
      )}
    </div>
  );
}
