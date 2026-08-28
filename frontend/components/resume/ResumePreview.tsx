"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ResumeData } from "@/lib/resume-types";
import { ResumeDocument } from "./ResumeDocument";

interface Props {
  data: ResumeData;
}

// A4 dimensions in px at 96dpi
const A4_WIDTH_PX = 794; // 210mm
const A4_HEIGHT_PX = 1123; // 297mm

export function ResumePreview({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [overflow, setOverflow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Fit-to-width scaling
  useEffect(() => {
    const compute = () => {
      if (!containerRef.current) return;
      const available = containerRef.current.clientWidth - 48;
      const fit = Math.min(available / A4_WIDTH_PX, 1);
      setScale(fit);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Detect page overflow
  useEffect(() => {
    if (!docRef.current) return;
    const h = docRef.current.scrollHeight;
    setOverflow(h > A4_HEIGHT_PX + 8);
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
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>
              Content exceeds one page
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
            onClick={() => window.print()}
            disabled={!data.personal.fullName}
            className="magnetic-btn text-sm font-semibold px-5 py-2 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 4px 16px rgba(108,99,255,0.2)" }}
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* On-screen scaled preview (hidden during print) */}
      <div
        ref={containerRef}
        className="rd-screen-only flex-1 overflow-auto rounded-xl p-6 flex justify-center"
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

      {/* Print-only copy — portaled to body at natural A4 scale.
          This is the ONLY thing visible when printing. */}
      {mounted && createPortal(
        <div className="rd-print-only">
          <ResumeDocument data={data} />
        </div>,
        document.body
      )}
    </div>
  );
}
