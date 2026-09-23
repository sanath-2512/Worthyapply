"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "./Icon";

interface Props {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: IconName;
  tone?: string;
  meta?: React.ReactNode;
}

/** Disclosure panel with a height transition and a proper button/region pair. */
export function Accordion({ title, children, defaultOpen = false, icon, tone = "var(--text-muted)", meta }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="card overflow-hidden transition-colors" style={{ borderColor: open ? "var(--border)" : undefined }}>
      <h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--surface-elevated)]"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
        >
          <span className="inline-flex items-center gap-3 min-w-0">
            {icon && (
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ background: "var(--surface-elevated)", color: tone }}>
                <Icon name={icon} size={14} />
              </span>
            )}
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {title}
            </span>
            {meta}
          </span>
          <span
            className="inline-flex transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "rotate(0)" }}
          >
            <Icon name="chevron-down" size={16} />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-button`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
