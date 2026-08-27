"use client";

import dynamic from "next/dynamic";
import { ResumeData } from "@/lib/resume-types";
import { useState } from "react";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <PreviewSkeleton /> }
);

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

const WorthyClassicPDF = dynamic(
  () => import("./WorthyClassicPDF").then((mod) => ({ default: mod.WorthyClassicPDF })),
  { ssr: false }
);

interface Props {
  data: ResumeData;
}

export function ResumePreview({ data }: Props) {
  const fileName = data.personal.fullName
    ? `${data.personal.fullName.replace(/\s+/g, "_")}_Resume.pdf`
    : "Resume.pdf";

  return (
    <div className="flex flex-col h-full">
      {/* Download button */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
          Worthy Classic
        </span>
        <PDFDownloadLink
          document={<WorthyClassicPDF data={data} />}
          fileName={fileName}
        >
          {({ loading }) => (
            <button
              disabled={loading || !data.personal.fullName || !data.personal.email}
              className="magnetic-btn text-sm font-semibold px-5 py-2 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: "var(--accent)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(108,99,255,0.2)",
              }}
            >
              {loading ? "Generating..." : "Download PDF"}
            </button>
          )}
        </PDFDownloadLink>
      </div>

      {/* Preview */}
      <div className="flex-1 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-subtle)", minHeight: "600px" }}>
        <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: "none" }}>
          <WorthyClassicPDF data={data} />
        </PDFViewer>
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="flex items-center justify-center h-full" style={{ minHeight: "600px" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading preview...</p>
    </div>
  );
}
