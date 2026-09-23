import { Reveal } from "../motion/Reveal";
import { SplitHeading } from "../motion/SplitHeading";
import { Button, ButtonLink } from "../ui/Button";

export function FinalCta({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section aria-labelledby="cta-title" className="relative py-28 sm:py-40 overflow-hidden">
      {/* Horizon glow */}
      <div
        className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-[1100px] max-w-[160vw] aspect-square rounded-full"
        style={{ background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 60%)" }}
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[62%] w-[900px] max-w-[140vw] aspect-square rounded-full border"
        style={{ borderColor: "var(--border)" }}
        aria-hidden="true"
      />
      <div className="container-x relative text-center">
        <SplitHeading as="h2" id="cta-title" className="display-lg max-w-[900px] mx-auto" style={{ color: "var(--text)" }}>
          Send five sharp applications, not <span className="serif-accent" style={{ color: "var(--accent-bright)" }}>fifty</span> generic ones.
        </SplitHeading>
        <Reveal delay={0.2}>
          <p className="lead mt-6 max-w-xl mx-auto">
            Check your fit, let WorthyApply tailor your resume, and apply knowing it actually matches the job. Built on your words — never invented ones.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto">
            <Button size="lg" magnetic onClick={onGetStarted} iconRight="arrow-right">
              Check my fit
            </Button>
            <ButtonLink href="/builder" variant="secondary" size="lg" iconLeft="pencil">
              Build a resume instead
            </ButtonLink>
          </div>
          <p className="text-[12.5px] mt-6" style={{ color: "var(--text-muted)" }}>
            No account. Runs on your job, your words.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
