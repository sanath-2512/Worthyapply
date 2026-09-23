import Link from "next/link";
import { Logo } from "../ui/Logo";
import { ThemeToggle } from "../ui/ThemeToggle";

export function SiteFooter({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <footer className="relative border-t" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
      <div className="container-x py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr] items-start">
        <div>
          <Logo />
          <p className="mt-4 text-[13.5px] leading-relaxed max-w-xs" style={{ color: "var(--text-muted)" }}>
            Make every application worth submitting. Explainable fit, honest tailoring, a clean PDF.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-4" style={{ color: "var(--text-muted)" }}>Product</p>
          <ul className="space-y-2.5 text-[13.5px]">
            <li>
              <button type="button" onClick={onGetStarted} className="link-underline" style={{ color: "var(--text-secondary)" }}>
                Analyze a job
              </button>
            </li>
            <li>
              <Link href="/builder" className="link-underline" style={{ color: "var(--text-secondary)" }}>
                Resume builder
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] mb-4" style={{ color: "var(--text-muted)" }}>Principles</p>
          <ul className="space-y-2.5 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            <li>No account required</li>
            <li>Nothing invented</li>
            <li>You have the final say</li>
          </ul>
        </div>
      </div>
      <div className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="container-x py-5 flex items-center justify-between gap-4">
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>WorthyApply — built on your words, never invented ones.</p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
