/**
 * Absorbs floating-point noise so a difference of exactly the tolerance passes
 * (0.92 − 0.9 is 0.020000000000000018 in IEEE 754).
 */
const EPSILON = 1e-9;

/** True when `actual` differs from `expected` by more than `tolerance`. */
export function outOfTolerance(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) > tolerance + EPSILON;
}

export function isGreater(value: number, limit: number): boolean {
  return value > limit + EPSILON;
}

export function isLess(value: number, limit: number): boolean {
  return value < limit - EPSILON;
}

/** "28.5 mm", "0.3 mm"; pass `digits` for a fixed precision ("30.0 mm", "0.90 mm"). */
export function mm(value: number, digits?: number): string {
  const text = digits === undefined ? String(Number(value.toFixed(2))) : value.toFixed(digits);
  return `${text} mm`;
}
