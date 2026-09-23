"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * App-wide client providers, mounted once in the root layout.
 * MotionConfig makes every framer-motion animation honour the OS
 * reduced-motion setting (transforms are skipped; opacity still fades).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // The app positions scroll itself (new views start at the top; Results
  // returns to the saved reading position). Browser restoration would apply a
  // stale offset to the momentary placeholder view first and fight that.
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
