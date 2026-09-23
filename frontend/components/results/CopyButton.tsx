"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

/** Clipboard copy with the legacy execCommand fallback for older browsers. */
export async function copyText(text: string) {
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
}

export function CopyButton({ text, label = "Copy improved bullet", toastMessage = "Bullet copied to clipboard" }: { text: string; label?: string; toastMessage?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    await copyText(text);
    setCopied(true);
    toast(toastMessage);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="relative inline-flex items-center gap-1.5 h-8 text-[12px] font-medium px-2.5 rounded-lg transition-[background,color,border-color] duration-200 active:scale-95"
      style={{
        background: copied ? "var(--green-dim)" : "var(--surface)",
        color: copied ? "var(--green)" : "var(--text-secondary)",
        border: `1px solid ${copied ? "var(--green-glow)" : "var(--border)"}`,
      }}
      aria-label={copied ? "Copied to clipboard" : label}
    >
      <span className="relative w-3 h-3 inline-flex">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={copied ? "c" : "n"}
            initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 26 }}
            className="absolute inset-0 inline-flex"
          >
            <Icon name={copied ? "check" : "copy"} size={12} strokeWidth={copied ? 2.5 : 1.75} />
          </motion.span>
        </AnimatePresence>
      </span>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
