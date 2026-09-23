"use client";

/**
 * Segmented control with a sliding indicator. Implements the WAI-ARIA tabs
 * keyboard model (arrow keys, Home/End) so it is a real tablist, not a row of
 * look-alike buttons.
 */
import { useId, useRef } from "react";
import { motion } from "framer-motion";
import { Icon, type IconName } from "./Icon";

export interface TabItem<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: IconName;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
  label: string;
  className?: string;
  /** Optional id prefix so tabs can reference panels via aria-controls. */
  panelIdPrefix?: string;
}

export function Tabs<T extends string>({ items, value, onChange, size = "md", label, className = "", panelIdPrefix }: Props<T>) {
  const layoutId = `tabs-${useId()}`;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  const pad = size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-[13px]";

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 p-1 rounded-xl ${className}`}
      style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-subtle)" }}
    >
      {items.map((item, i) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelIdPrefix ? `${panelIdPrefix}-${item.id}` : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`relative ${pad} rounded-lg font-medium whitespace-nowrap transition-colors duration-200`}
            style={{ color: active ? "var(--text)" : "var(--text-muted)" }}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg"
                style={{ background: "var(--surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {item.icon && <Icon name={item.icon} size={14} />}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
