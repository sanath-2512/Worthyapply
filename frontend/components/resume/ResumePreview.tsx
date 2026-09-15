"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ResumeData } from "@/lib/resume-types";
import { useMounted } from "@/lib/use-mounted";
import { ResumeDocument } from "./ResumeDocument";
import { Icon } from "../ui/Icon";

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
  // Measured document height, so the scaled wrapper reserves the right space
  // instead of reading a ref during render (which renders one frame too short).
  const [docHeight, setDocHeight] = useState(A4_HEIGHT_PX);
  const mounted = useMounted();

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

  // Measure the rendered document: drives both the one-page warning and the
  // height the scaled wrapper reserves.
  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const measure = () => {
      const height = el.scrollHeight;
      setOverflow(height > A4_HEIGHT_PX + 4);
      setDocHeight(Math.max(height, A4_HEIGHT_PX));
    };
    measure();
    const ro = new ResizeObserver(measure);
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
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>
              <Icon name="alert" size={13} /> Resume exceeds one page
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
            type="button"
            onClick={handleDownload}
            disabled={!data.personal.fullName}
            className="btn btn-primary btn-sm magnetic-btn"
            title={data.personal.fullName ? undefined : "Add your name to enable export"}
          >
            <Icon name="download" size={15} />
            Download PDF
          </button>
        </div>
      </div>

      {/* On-screen scaled preview */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto rounded-xl p-6 flex justify-center"
        style={{ background: "var(--viewer-bg)" }}
      >
        <div
          style={{
            width: A4_WIDTH_PX * effectiveScale,
            height: docHeight * effectiveScale,
          }}
        >
          <div
            ref={docRef}
            style={{
              transform: `scale(${effectiveScale})`,
              transformOrigin: "top left",
              width: A4_WIDTH_PX,
              boxShadow: "var(--viewer-shadow)",
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
