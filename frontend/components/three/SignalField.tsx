"use client";

/**
 * The WebGL layer: a single draw call of GPU-animated points.
 *
 * Every particle has two homes — a scattered position ("the noisy job
 * market") and a place in an ordered form: a sphere wrapped by three orbit
 * rings ("your fit, resolved"). One `uProgress` uniform morphs between them
 * with a per-particle delay, so the form assembles organically rather than
 * all at once. All motion happens in the vertex shader; the CPU only eases a
 * handful of uniforms per frame.
 *
 * Loaded only on the client, via next/dynamic, by SignalScene.
 */
import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneDriver } from "./driver";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uEnergy;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 aScatter;
  attribute float aSeed;
  attribute float aKind;
  varying float vAlpha;
  varying float vKind;

  void main() {
    // Stagger the morph per particle so the form assembles, not snaps.
    float delay = aSeed * 0.4;
    float p = smoothstep(delay, delay + 0.6, uProgress);

    // Scattered particles wander; aligned ones only breathe.
    float wander = mix(0.45, 0.035, p);
    vec3 drift = vec3(
      sin(uTime * 0.31 + aSeed * 41.0),
      cos(uTime * 0.27 + aSeed * 23.0),
      sin(uTime * 0.22 + aSeed * 17.0)
    ) * wander;

    vec3 pos = mix(aScatter, position, p) + drift;

    // Processing energy: a travelling pulse through the form.
    pos *= 1.0 + uEnergy * 0.05 * sin(uTime * 2.4 - length(position) * 2.2 + aSeed * 3.0);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * (0.55 + aSeed * 0.9) * (aKind > 0.5 ? 1.35 : 1.0);
    gl_PointSize = size * uPixelRatio * (12.0 / -mv.z);

    // Depth fade keeps the far side of the form quieter than the near side.
    float depth = smoothstep(-14.0, -5.0, mv.z);
    vAlpha = mix(0.28, 0.95, p) * (0.45 + aSeed * 0.55) * mix(0.35, 1.0, depth);
    vKind = aKind;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vKind;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = pow(smoothstep(0.5, 0.0, d), 1.7);
    vec3 col = vKind > 1.5 ? uColorC : (vKind > 0.5 ? uColorB : uColorA);
    gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  }
`;

interface Palette {
  a: string;
  b: string;
  c: string;
  opacity: number;
  additive: boolean;
}

export const PALETTES: Record<"dark" | "light", Palette> = {
  dark: { a: "#8fa6ff", b: "#54d6ff", c: "#f5a623", opacity: 0.95, additive: true },
  light: { a: "#3d5cf5", b: "#0891c2", c: "#c77a0a", opacity: 0.8, additive: false },
};

/** Deterministic PRNG so the field looks the same on every visit. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGeometry(count: number) {
  const rand = mulberry32(7);
  const target = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const kind = new Float32Array(count);

  const sphereCount = Math.floor(count * 0.64);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const rings = [
    { r: 2.75, tiltX: 1.2, tiltZ: 0.25 },
    { r: 3.15, tiltX: 0.35, tiltZ: -0.6 },
    { r: 3.55, tiltX: -0.75, tiltZ: 0.9 },
  ];

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    let x: number, y: number, z: number;

    if (i < sphereCount) {
      // Fibonacci sphere: even coverage without clumping at the poles.
      const t = i / sphereCount;
      const yy = 1 - t * 2;
      const rr = Math.sqrt(1 - yy * yy);
      const th = golden * i;
      const R = 1.95 + (rand() - 0.5) * 0.08;
      x = Math.cos(th) * rr * R;
      y = yy * R;
      z = Math.sin(th) * rr * R;
    } else {
      const ring = rings[i % 3];
      const a = rand() * Math.PI * 2;
      const R = ring.r + (rand() - 0.5) * 0.12;
      const px = Math.cos(a) * R;
      const pz = Math.sin(a) * R;
      const py = (rand() - 0.5) * 0.05;
      // Tilt the ring (rotate about X then Z).
      const cy = Math.cos(ring.tiltX), sy = Math.sin(ring.tiltX);
      const y1 = py * cy - pz * sy;
      const z1 = py * sy + pz * cy;
      const cz = Math.cos(ring.tiltZ), sz = Math.sin(ring.tiltZ);
      x = px * cz - y1 * sz;
      y = px * sz + y1 * cz;
      z = z1;
    }
    target[i3] = x;
    target[i3 + 1] = y;
    target[i3 + 2] = z;

    // Scatter: a wide, flattened cloud with a denser core.
    const u = Math.pow(rand(), 0.7);
    const th = rand() * Math.PI * 2;
    const ph = Math.acos(2 * rand() - 1);
    scatter[i3] = Math.sin(ph) * Math.cos(th) * 8.5 * u;
    scatter[i3 + 1] = Math.cos(ph) * 4.2 * u;
    scatter[i3 + 2] = Math.sin(ph) * Math.sin(th) * 5 * u - 1;

    seed[i] = rand();
    const k = rand();
    // ~9% "matched" highlights, ~4% warm "gap" particles.
    kind[i] = k < 0.04 ? 2 : k < 0.13 ? 1 : 0;
  }

  return { target, scatter, seed, kind };
}

interface FieldProps {
  driver: RefObject<SceneDriver>;
  count: number;
  palette: Palette;
  animate: boolean;
  active: boolean;
  offsetX: number;
}

function Field({ driver, count, palette, animate, active, offsetX }: FieldProps) {
  // three.js objects are mutated every frame, so they live behind refs; R3F
  // creates them from JSX and disposes them on unmount.
  const group = useRef<THREE.Group>(null);
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { gl, invalidate } = useThree();
  const attrs = useMemo(() => buildGeometry(count), [count]);

  // Initial uniform values; the material keeps and mutates this object.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uEnergy: { value: 0 },
      uSize: { value: 4.2 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uColorA: { value: new THREE.Color() },
      uColorB: { value: new THREE.Color() },
      uColorC: { value: new THREE.Color() },
      uOpacity: { value: 1 },
    }),
    [gl]
  );

  // The morph moves points outside the target bounds; a generous sphere keeps
  // frustum culling from ever dropping the whole cloud.
  useLayoutEffect(() => {
    if (geoRef.current) geoRef.current.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
  }, [attrs]);

  // Without motion there is nothing to ease from: start at the driver's state.
  useLayoutEffect(() => {
    const m = matRef.current;
    if (!m || animate) return;
    m.uniforms.uProgress.value = driver.current.progress;
    m.uniforms.uEnergy.value = driver.current.energy;
  }, [animate, driver]);

  // Theme changes swap colours and blending without rebuilding anything.
  useLayoutEffect(() => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uColorA.value.set(palette.a);
    m.uniforms.uColorB.value.set(palette.b);
    m.uniforms.uColorC.value.set(palette.c);
    m.uniforms.uOpacity.value = palette.opacity;
    m.blending = palette.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.needsUpdate = true;
    invalidate();
  }, [palette, invalidate]);

  useFrame((state, delta) => {
    const m = matRef.current;
    const g = group.current;
    const d = driver.current;
    if (!m || !g) return;
    const u = m.uniforms;
    const dt = Math.min(delta, 1 / 30);
    // Frame-rate independent easing toward the driver.
    const k = 1 - Math.exp(-dt * 3.2);
    u.uProgress.value += (d.progress - u.uProgress.value) * k;
    u.uEnergy.value += (d.energy - u.uEnergy.value) * k;
    if (animate) u.uTime.value += dt;

    if (animate) g.rotation.y += dt * (0.06 + u.uEnergy.value * 0.35);
    // Pointer parallax: tilt the whole form a few degrees toward the cursor.
    const tx = d.pointerY * 0.18;
    const tz = -d.pointerX * 0.08;
    g.rotation.x += (tx + 0.18 - g.rotation.x) * k;
    g.rotation.z += (tz - g.rotation.z) * k;
    g.position.x += (offsetX + d.pointerX * 0.25 - g.position.x) * k;

    // In "demand" mode (reduced motion) keep rendering only until the eased
    // values settle, then let the loop go idle. Off-screen: never.
    if (active && !animate) {
      const settling =
        Math.abs(d.progress - u.uProgress.value) > 0.002 ||
        Math.abs(d.energy - u.uEnergy.value) > 0.002 ||
        Math.abs(tx + 0.18 - g.rotation.x) > 0.001;
      if (settling) state.invalidate();
    }
  });

  return (
    <group ref={group} position={[offsetX, 0, 0]}>
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" args={[attrs.target, 3]} />
          <bufferAttribute attach="attributes-aScatter" args={[attrs.scatter, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[attrs.seed, 1]} />
          <bufferAttribute attach="attributes-aKind" args={[attrs.kind, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={matRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  );
}

export interface SignalFieldProps {
  driver: RefObject<SceneDriver>;
  count: number;
  theme: "dark" | "light";
  animate: boolean;
  active: boolean;
  /** Horizontal offset of the form, in world units (hero puts it right). */
  offsetX?: number;
  dpr: [number, number];
  onReady?: () => void;
}

export default function SignalField({ driver, count, theme, animate, active, offsetX = 0, dpr, onReady }: SignalFieldProps) {
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0, 9.5], fov: 45, near: 0.1, far: 50 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false, depth: false }}
      // Off-screen or reduced motion: stop the loop entirely.
      frameloop={active && animate ? "always" : "demand"}
      onCreated={() => onReady?.()}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    >
      <Field driver={driver} count={count} palette={PALETTES[theme]} animate={animate} active={active} offsetX={offsetX} />
    </Canvas>
  );
}
