import type { Crystal } from "@/domain/types";
import { fmt } from "./geometry";
import type { WatchLayout } from "./layout";
import { PLACEHOLDER, url, type IdFor } from "./svg";

const GLARE_BY_SHAPE: Record<Crystal["shape"], number> = { flat: 0.14, domed: 0.22, "double-dome": 0.28 };
/** Anti-reflective coating cuts glare; coating both faces cuts it most. */
const AR_FACTOR: Record<Crystal["arCoating"], number> = { none: 1, inner: 0.8, both: 0.55 };

interface CrystalLayerProps {
  crystal?: Crystal;
  layout: WatchLayout;
  idFor: IdFor;
}

/** Reflections on the crystal: a soft crescent of window light, stronger on domed shapes. */
export function CrystalLayer({ crystal, layout, idFor }: CrystalLayerProps) {
  const r = layout.openingR;
  if (!crystal) {
    return <circle r={fmt(r)} {...PLACEHOLDER} fillOpacity={0} strokeWidth={0.16} />;
  }
  const strength = (GLARE_BY_SHAPE[crystal.shape] ?? 0.12) * (AR_FACTOR[crystal.arCoating] ?? 1);
  const domed = crystal.shape !== "flat";
  // A crescent between the opening's upper-left edge and a flatter arc inside it.
  const crescent =
    `M${fmt(-r)} 0A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(r * 0.2)} ${fmt(-r * 0.98)}` +
    `A${fmt(r * 1.3)} ${fmt(r * 1.3)} 0 0 0 ${fmt(-r)} 0Z`;

  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={idFor("crystal-edge")} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={fmt(r)}>
          <stop offset={domed ? "0.78" : "0.9"} stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={domed ? 0.28 : 0.12} />
        </radialGradient>
        <linearGradient id={idFor("crystal-glare")} gradientUnits="userSpaceOnUse" x1={fmt(-r)} y1={fmt(-r)} x2="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={strength * 2.2} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={idFor("crystal-sheen")} gradientUnits="userSpaceOnUse" x1={fmt(-r)} y1={fmt(-r)} x2={fmt(r)} y2={fmt(r)}>
          <stop offset="0.3" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.42" stopColor="#fff" stopOpacity={strength * 0.45} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <circle r={fmt(r)} fill={url(idFor("crystal-edge"))} />
      <circle r={fmt(r)} fill={url(idFor("crystal-sheen"))} />
      <path d={crescent} fill={url(idFor("crystal-glare"))} filter={url(idFor("blur-glow"))} />
      {domed && (
        <ellipse
          cx={fmt(r * 0.52)}
          cy={fmt(r * 0.56)}
          rx={fmt(r * 0.16)}
          ry={fmt(r * 0.06)}
          transform={`rotate(-45 ${fmt(r * 0.52)} ${fmt(r * 0.56)})`}
          fill="#fff"
          opacity={strength * 1.4}
          filter={url(idFor("blur-glow"))}
        />
      )}
    </g>
  );
}
