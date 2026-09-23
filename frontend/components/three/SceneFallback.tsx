/**
 * Static rendition of the signal form for first paint, no-WebGL devices and
 * Save-Data users: a soft glow, a dotted sphere and three tilted orbits in
 * SVG. It is also what the WebGL canvas cross-fades from, so the composition
 * matches.
 */
export function SceneFallback({ offset = 0 }: { offset?: number }) {
  // offset is in world units in the 3D scene; roughly 7% of width per unit.
  const shift = `${offset * 7}%`;
  const dots = Array.from({ length: 70 }, (_, i) => {
    const t = i / 70;
    const y = 1 - t * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    // Rounded so server and client markup match exactly.
    const q = (n: number) => Math.round(n * 100) / 100;
    return { x: q(50 + Math.cos(th) * r * 17), y: q(50 + y * 17), o: q(0.25 + (Math.sin(th) * r + 1) * 0.35) };
  });
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 w-[70vmin] h-[70vmin] rounded-full"
        style={{
          transform: `translate(calc(-50% + ${shift}), -50%)`,
          background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 62%)",
          filter: "blur(10px)",
        }}
      />
      <svg
        viewBox="0 0 100 100"
        className="absolute top-1/2 left-1/2 w-[78vmin] h-[78vmin] max-w-[760px] max-h-[760px]"
        style={{ transform: `translate(calc(-50% + ${shift}), -50%)` }}
      >
        {[
          { rx: 30, ry: 9, rot: -18 },
          { rx: 34, ry: 13, rot: 24 },
          { rx: 38, ry: 7, rot: 62 },
        ].map((o, i) => (
          <ellipse
            key={i}
            cx="50"
            cy="50"
            rx={o.rx}
            ry={o.ry}
            fill="none"
            stroke="var(--accent-bright)"
            strokeOpacity={0.28 - i * 0.05}
            strokeWidth="0.25"
            strokeDasharray="0.4 1.2"
            transform={`rotate(${o.rot} 50 50)`}
          />
        ))}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={0.45} fill="var(--accent-bright)" opacity={d.o} />
        ))}
      </svg>
    </div>
  );
}
