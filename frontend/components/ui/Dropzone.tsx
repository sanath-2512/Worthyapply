"use client";

/**
 * Presentational PDF drop target shared by the analysis workspace and the
 * resume importer. Validation and the chosen file stay owned by the caller;
 * this only renders the states (empty / dragging / selected / invalid) and
 * reports picked files.
 */
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./Icon";

interface Props {
  file: File | null;
  error?: string;
  onFile: (file: File) => void;
  onClear?: () => void;
  label?: string;
  hint?: string;
  id?: string;
  disabled?: boolean;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Dropzone({ file, error, onFile, onClear, label = "Upload resume PDF", hint = "PDF · up to 10 MB", id, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const errorId = id ? `${id}-error` : undefined;

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  const border = dragOver ? "var(--accent)" : error ? "var(--red)" : file ? "var(--green-glow)" : "var(--border)";
  const bg = dragOver ? "var(--accent-dim)" : "var(--bg-elevated)";

  return (
    <div>
      <div
        id={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={(e) => {
          // Ignore leave events fired when crossing into child elements.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f && !disabled) onFile(f);
        }}
        onClick={open}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-label={file ? `${label}. Selected: ${file.name}. Activate to replace.` : label}
        aria-describedby={error ? errorId : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="group relative rounded-2xl cursor-pointer overflow-hidden transition-[border-color,background,box-shadow] duration-300"
        style={{
          border: `1px ${file ? "solid" : "dashed"} ${border}`,
          background: bg,
          boxShadow: dragOver ? "0 0 0 4px var(--accent-dim)" : "none",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            // Allow re-selecting the same file after clearing it.
            e.target.value = "";
          }}
        />
        <AnimatePresence mode="wait" initial={false}>
          {file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3.5 p-4 sm:p-5"
            >
              <div
                className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--green-dim)", color: "var(--green)" }}
              >
                <Icon name="document" size={20} />
                <span
                  className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "var(--green)", color: "var(--bg)", boxShadow: "0 0 0 3px var(--bg-elevated)" }}
                >
                  <Icon name="check" size={11} strokeWidth={3} />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                  {file.name}
                </p>
                <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {formatSize(file.size)} · ready
                </p>
              </div>
              <span
                className="hidden sm:inline text-xs font-medium px-3 py-1.5 rounded-lg transition-colors group-hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--text-secondary)", background: "var(--surface-elevated)" }}
              >
                Replace
              </span>
              {onClear && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="icon-btn"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Remove selected file"
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center text-center px-6 py-8 sm:py-10"
            >
              <motion.div
                animate={dragOver ? { y: -4, scale: 1.06 } : { y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors"
                style={{
                  background: dragOver ? "var(--accent)" : "var(--surface-elevated)",
                  color: dragOver ? "#fff" : "var(--accent-bright)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <Icon name="upload" size={20} />
              </motion.div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {dragOver ? "Drop to upload" : (
                  <>
                    Drop your resume here, or <span style={{ color: "var(--accent-bright)" }}>browse</span>
                  </>
                )}
              </p>
              <p className="text-xs font-mono mt-1.5" style={{ color: "var(--text-muted)" }}>
                {hint}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 text-xs overflow-hidden"
            style={{ color: "var(--red)" }}
          >
            <span className="pt-2 inline-flex items-center gap-1.5">
              <Icon name="alert" size={13} /> {error}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
