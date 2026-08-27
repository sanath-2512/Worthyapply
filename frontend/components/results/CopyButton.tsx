"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="text-[10px] font-medium px-2.5 py-1 rounded-lg transition-all duration-200"
      style={{
        background: copied ? "var(--green-dim)" : "var(--bg-elevated)",
        color: copied ? "var(--green)" : "var(--text-muted)",
        border: `1px solid ${copied ? "var(--green)" : "var(--border)"}`,
      }}
      aria-label={copied ? "Copied to clipboard" : "Copy improved bullet"}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
