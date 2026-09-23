"use client";

/**
 * Lightweight toast system. One polite live region for the whole app, so
 * screen readers announce confirmations ("Copied") without stealing focus.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "./Icon";

type Tone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  toast: (message: string, opts?: { tone?: Tone; duration?: number }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE: Record<Tone, { icon: IconName; color: string; bg: string }> = {
  success: { icon: "check", color: "var(--green)", bg: "var(--green-dim)" },
  error: { icon: "alert", color: "var(--red)", bg: "var(--red-dim)" },
  info: { icon: "sparkle", color: "var(--accent-bright)", bg: "var(--accent-dim)" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastApi["toast"]>(
    (message, opts = {}) => {
      const id = ++nextId.current;
      // Newest last; cap the stack so rapid actions don't pile up.
      setItems((prev) => [...prev.slice(-2), { id, message, tone: opts.tone ?? "success" }]);
      window.setTimeout(() => dismiss(id), opts.duration ?? 2600);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="no-print fixed z-[200] bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 flex flex-col items-center sm:items-end gap-2 pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const tone = TONE[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="glass pointer-events-auto flex items-center gap-2.5 pl-2.5 pr-2 py-2 rounded-xl text-[13px] font-medium max-w-[min(92vw,380px)]"
                style={{ boxShadow: "var(--shadow-pop)", color: "var(--text)" }}
              >
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-lg shrink-0"
                  style={{ background: tone.bg, color: tone.color }}
                >
                  <Icon name={tone.icon} size={13} strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1">{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="icon-btn !min-w-7 !min-h-7"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Dismiss notification"
                >
                  <Icon name="x" size={13} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** No-op outside the provider, so components stay usable in isolation. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { toast: () => {} };
}
