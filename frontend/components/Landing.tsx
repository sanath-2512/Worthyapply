"use client";

import { SiteNav } from "./landing/SiteNav";
import { Hero } from "./landing/Hero";
import { ProofStrip } from "./landing/ProofStrip";
import { HowItWorks } from "./landing/HowItWorks";
import { TailorFeature } from "./landing/TailorFeature";
import { FeatureGrid } from "./landing/FeatureGrid";
import { Principle } from "./landing/Principle";
import { BuilderShowcase } from "./landing/BuilderShowcase";
import { FinalCta } from "./landing/FinalCta";
import { SiteFooter } from "./landing/SiteFooter";

interface Props {
  onGetStarted: () => void;
}

export function Landing({ onGetStarted }: Props) {
  return (
    <div className="relative">
      <SiteNav onGetStarted={onGetStarted} />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero onGetStarted={onGetStarted} />
        <ProofStrip />
        <HowItWorks />
        <TailorFeature onGetStarted={onGetStarted} />
        <Principle />
        <FeatureGrid />
        <BuilderShowcase />
        <FinalCta onGetStarted={onGetStarted} />
      </main>
      <SiteFooter onGetStarted={onGetStarted} />
    </div>
  );
}
