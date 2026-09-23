/**
 * Mutable bridge between page code (GSAP timelines, pipeline events, pointer)
 * and the WebGL scene. The scene eases toward these values every frame, so
 * writers can set them abruptly and React never re-renders to animate.
 */
export interface SceneDriver {
  /** 0 = scattered noise, 1 = fully aligned "fit" form. */
  progress: number;
  /** 0 = calm idle drift, 1 = busy (processing): faster spin and pulse. */
  energy: number;
  /** Normalised pointer, -1..1. */
  pointerX: number;
  pointerY: number;
}

export function createDriver(partial: Partial<SceneDriver> = {}): SceneDriver {
  return { progress: 0, energy: 0, pointerX: 0, pointerY: 0, ...partial };
}
