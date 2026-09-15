"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * True once the component has hydrated on the client, false during SSR and the
 * first render. Used to defer `createPortal` (which needs a real `document`)
 * without a setState-in-effect cascade.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
