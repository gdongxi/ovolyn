/**
 * The engraving set.
 *
 * Ovolyn's mark is a reeded vault — a milled coin edge around a keyhole. That
 * milling is the visual language of money itself: banknotes, share
 * certificates and passports are all printed with guilloché, the interference
 * pattern of two rotating circles. Everything here is drawn from that same
 * geometry in code, so the brand carries no image files at all.
 */

/**
 * One rosette: the hypotrochoid traced by a circle of radius r rolling inside
 * a circle of radius R, with the pen offset d from its centre. Choosing R as a
 * whole multiple of r closes the curve into an even number of petals — which
 * is exactly how an engine-turning lathe cuts a banknote plate.
 */
function rosettePath(cx: number, cy: number, R: number, r: number, d: number): string {
  // Integer radii only: the closure count comes from their gcd, and a
  // fractional radius would send that search off to absurd lengths.
  R = Math.round(R);
  r = Math.round(r);
  const k = (R - r) / r;
  const turns = Math.min(r / gcd(R, r), 12);
  const step = 0.035;
  const points: string[] = [];
  for (let t = 0; t <= Math.PI * 2 * turns + step; t += step) {
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(k * t);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${points.join(" L")}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * An engine-turned plate. Small, many-petalled rosettes tiled on a lattice and
 * drawn in hairlines — the pattern should read as fine machining, never as a
 * smudge, so it stays quiet behind type.
 */
export function Guilloche({
  width = 1440,
  height = 520,
  stroke = "#201f1d",
  opacity = 0.14,
  className,
}: {
  width?: number;
  height?: number;
  stroke?: string;
  opacity?: number;
  className?: string;
}) {
  const R = 96;
  const pitch = 132;
  const cols = Math.ceil(width / pitch) + 1;
  const rows = Math.ceil(height / pitch) + 1;
  const paths: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Offset every other row so the lattice interlocks, as on a banknote.
      const cx = col * pitch + (row % 2 ? pitch / 2 : 0);
      const cy = row * pitch;
      paths.push(rosettePath(cx, cy, R, 8, 44));
      paths.push(rosettePath(cx, cy, R * 0.72, 6, 32));
    }
  }
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ opacity }}
    >
      <g fill="none" stroke={stroke} strokeWidth="0.35">
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

/** The mark's milled edge, unrolled into a rule. Every eighth tooth is long. */
export function ReededRule({ width = 240, className }: { width?: number; className?: string }) {
  const teeth = 72;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} 12`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1">
        {Array.from({ length: teeth }, (_, i) => {
          const x = (i * width) / teeth + 0.5;
          return <line key={i} x1={x} x2={x} y1={1} y2={i % 8 === 0 ? 11 : 6.5} />;
        })}
      </g>
    </svg>
  );
}

/**
 * The treasury balance as engraved on a certificate: a single line, no axes,
 * no gridlines. Drawn from real ledger events.
 */
export function BalanceLine({ series, width = 560, height = 96 }: { series: number[]; width?: number; height?: number }) {
  if (series.length < 2) return null;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const pad = 8;
  const points = series.map((v, i) => {
    const x = (i / (series.length - 1)) * width;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L")}`;
  const [lastX, lastY] = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} aria-hidden="true">
      <path d={`${line} L${width},${height} L0,${height} Z`} fill="currentColor" fillOpacity="0.06" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx={lastX} cy={lastY} r="3" fill="currentColor" />
    </svg>
  );
}
