"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "../ui/Logo";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { useSmoothScroll } from "../providers/SmoothScroll";

const SECTIONS = [
  { id: "how", label: "How it works" },
  { id: "tailoring", label: "Tailoring" },
  { id: "features", label: "Features" },
];

export function SiteNav({ onGetStarted }: { onGetStarted: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const { scrollTo } = useSmoothScroll();

  // Solid glass only after leaving the very top, so the hero reads edge to edge.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active-section indication for the in-page links.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    els.forEach((el) => io.observe(el));
    const top = () => {
      if (window.scrollY < window.innerHeight * 0.5) setActive(null);
    };
    window.addEventListener("scroll", top, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", top);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    scrollTo(id, { offset: -72 });
  };

  return (
    <header className="fixed top-0 inset-x-0 z-[100] print:hidden">
      <div
        className="transition-[background,border-color,backdrop-filter] duration-500"
        style={{
          background: scrolled || open ? "var(--nav-bg)" : "transparent",
          borderBottom: `1px solid ${scrolled || open ? "var(--border-subtle)" : "transparent"}`,
          backdropFilter: scrolled || open ? "blur(20px) saturate(150%)" : "none",
          WebkitBackdropFilter: scrolled || open ? "blur(20px) saturate(150%)" : "none",
        }}
      >
        <nav aria-label="Primary" className="container-x h-[var(--header-h)] flex items-center justify-between gap-4">
          <Link href="/" className="rounded-lg" aria-label="WorthyApply home">
            <Logo />
          </Link>

          <ul className="hidden lg:flex items-center gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(s.id);
                  }}
                  data-active={active === s.id}
                  aria-current={active === s.id ? "location" : undefined}
                  className="relative inline-flex items-center h-9 px-3 rounded-lg text-[13.5px] font-medium whitespace-nowrap transition-colors hover:text-[var(--text)]"
                  style={{ color: active === s.id ? "var(--text)" : "var(--text-secondary)" }}
                >
                  {s.label}
                  {active === s.id && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute left-3 right-3 -bottom-px h-px"
                      style={{ background: "var(--accent-bright)" }}
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                </a>
              </li>
            ))}
            <li>
              <Link
                href="/builder"
                className="inline-flex items-center h-9 px-3 rounded-lg text-[13.5px] font-medium whitespace-nowrap transition-colors hover:text-[var(--text)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Resume Builder
              </Link>
            </li>
          </ul>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button size="sm" onClick={onGetStarted} iconRight="arrow-right" className="hidden sm:inline-flex">
              Check my fit
            </Button>
            <button
              ref={menuBtnRef}
              type="button"
              className="icon-btn lg:hidden"
              style={{ color: "var(--text)" }}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              <span className="relative w-[18px] h-[12px]" aria-hidden="true">
                <span
                  className="absolute left-0 right-0 h-[1.5px] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ background: "currentColor", top: open ? 5 : 0, transform: open ? "rotate(45deg)" : "none" }}
                />
                <span
                  className="absolute left-0 right-0 h-[1.5px] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ background: "currentColor", top: open ? 5 : 10, transform: open ? "rotate(-45deg)" : "none" }}
                />
              </span>
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              id="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden overflow-hidden"
            >
              <div className="container-x pb-5 pt-1">
                <ul className="flex flex-col">
                  {SECTIONS.map((s, i) => (
                    <motion.li
                      key={s.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.04 }}
                    >
                      <a
                        href={`#${s.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          go(s.id);
                        }}
                        className="flex items-center justify-between py-3.5 text-[17px] font-medium border-b"
                        style={{ color: "var(--text)", borderColor: "var(--border-subtle)" }}
                      >
                        {s.label}
                        <Icon name="arrow-right" size={16} style={{ color: "var(--text-muted)" }} />
                      </a>
                    </motion.li>
                  ))}
                  <motion.li initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
                    <Link
                      href="/builder"
                      className="flex items-center justify-between py-3.5 text-[17px] font-medium border-b"
                      style={{ color: "var(--text)", borderColor: "var(--border-subtle)" }}
                    >
                      Resume Builder
                      <Icon name="arrow-right" size={16} style={{ color: "var(--text-muted)" }} />
                    </Link>
                  </motion.li>
                </ul>
                <Button
                  fullWidth
                  size="lg"
                  className="mt-5"
                  iconRight="arrow-right"
                  onClick={() => {
                    setOpen(false);
                    onGetStarted();
                  }}
                >
                  Check my fit
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
