import type { IdFor } from "./svg";
import { fmt } from "./geometry";

/**
 * Filters shared by every layer. Regions are in user space and cover the whole view (with margin),
 * so blurred and rotated elements are never clipped by the default bounding-box region.
 */
export function SharedDefs({ idFor, viewHalf }: { idFor: IdFor; viewHalf: number }) {
  const extent = viewHalf + 6;
  const region = {
    filterUnits: "userSpaceOnUse",
    x: fmt(-extent),
    y: fmt(-extent),
    width: fmt(extent * 2),
    height: fmt(extent * 2),
    colorInterpolationFilters: "sRGB",
  } as const;

  return (
    <defs>
      {/* Fine speckle for grained dials, leather and bead-blasted metal. Fixed seed: deterministic. */}
      <filter id={idFor("grain")} {...region}>
        <feTurbulence type="fractalNoise" baseFrequency="4.5" numOctaves={2} seed={11} result="noise" />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.4 0 0 0 -1.32"
          result="light"
        />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 1.08"
          result="dark"
        />
        <feMerge result="speckle">
          <feMergeNode in="dark" />
          <feMergeNode in="light" />
        </feMerge>
        <feComposite in="speckle" in2="SourceAlpha" operator="in" />
      </filter>
      <filter id={idFor("blur-hand")} {...region}>
        <feGaussianBlur stdDeviation="0.2" />
      </filter>
      <filter id={idFor("blur-soft")} {...region}>
        <feGaussianBlur stdDeviation="0.9" />
      </filter>
      <filter id={idFor("blur-glow")} {...region}>
        <feGaussianBlur stdDeviation="0.45" />
      </filter>
      <filter id={idFor("applied-shadow")} {...region}>
        <feDropShadow dx="0.09" dy="0.16" stdDeviation="0.1" floodColor="#000" floodOpacity="0.55" />
      </filter>
    </defs>
  );
}
