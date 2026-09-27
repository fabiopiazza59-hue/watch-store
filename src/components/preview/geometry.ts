// Geometry helpers for the preview. Everything is in millimetres, centred on the dial centre,
// with clock angles measured in degrees clockwise from 12 o'clock.

export type Point = readonly [number, number];

/** Round to 3 decimals for compact, stable SVG output. Non-finite values collapse to 0. */
export function fmt(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

/** A strictly positive finite number, or the fallback. Guards the renderer against bad part data. */
export function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Point at radius `r` and clock angle `deg` (0 = 12 o'clock, clockwise). */
export function polar(r: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)];
}

export function xy([x, y]: Point): string {
  return `${fmt(x)} ${fmt(y)}`;
}

/** Closed polygon path. */
export function polygon(points: readonly Point[]): string {
  return `M${points.map(xy).join("L")}Z`;
}

/**
 * Polygon symmetric about the y axis, from its right-hand outline. `right` runs from the base
 * towards the tip and ends on the axis; the left side is mirrored from it.
 */
export function symmetric(right: readonly Point[]): string {
  const left = right
    .slice(0, -1)
    .reverse()
    .map(([x, y]): Point => [-x, y]);
  return polygon([...right, ...left]);
}

/**
 * Circle as a path, wound the same way as `symmetric` outlines so several subpaths in one
 * path union cleanly under the default non-zero fill rule.
 */
export function circle(r: number, cx = 0, cy = 0): string {
  return (
    `M${fmt(cx + r)} ${fmt(cy)}` +
    `A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)}` +
    `A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)}Z`
  );
}

/** Ellipse as a path, wound like `circle`. */
export function ellipse(rx: number, ry: number, cx = 0, cy = 0): string {
  return (
    `M${fmt(cx + rx)} ${fmt(cy)}` +
    `A${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx - rx)} ${fmt(cy)}` +
    `A${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx + rx)} ${fmt(cy)}Z`
  );
}

/** Annulus between two radii; render with fillRule="evenodd". */
export function ring(outer: number, inner: number): string {
  return `${circle(outer)}${circle(inner)}`;
}

/** Annular sector between two radii and two clock angles (clockwise from `fromDeg`). */
export function sector(inner: number, outer: number, fromDeg: number, toDeg: number): string {
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return (
    `M${xy(polar(outer, fromDeg))}` +
    `A${fmt(outer)} ${fmt(outer)} 0 ${large} 1 ${xy(polar(outer, toDeg))}` +
    `L${xy(polar(inner, toDeg))}` +
    `A${fmt(inner)} ${fmt(inner)} 0 ${large} 0 ${xy(polar(inner, fromDeg))}Z`
  );
}

/** Pie wedge from the centre, used to build the sunburst. */
export function wedge(r: number, fromDeg: number, toDeg: number): string {
  return `M0 0L${xy(polar(r, fromDeg))}A${fmt(r)} ${fmt(r)} 0 0 1 ${xy(polar(r, toDeg))}Z`;
}

/** One path of radial tick marks: each tick runs from `outer` inwards to `inner`. */
export function radialTicks(angles: readonly number[], outer: number, inner: number): string {
  return angles.map((deg) => `M${xy(polar(outer, deg))}L${xy(polar(inner, deg))}`).join("");
}

/** Clock angles for `count` equally spaced marks, optionally filtered. */
export function divisions(count: number, keep: (index: number) => boolean = () => true): number[] {
  return Array.from({ length: count }, (_, i) => i)
    .filter(keep)
    .map((i) => (i * 360) / count);
}

/** A millimetre value for labels, to 0.1mm: "42", "47.5". */
export function mm(value: number): string {
  return fmt(Math.round(value * 10) / 10);
}
