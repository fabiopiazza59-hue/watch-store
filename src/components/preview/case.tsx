import type { WatchCase } from "@/domain/types";
import { caseMetal, type MetalTone } from "./color";
import { fmt } from "./geometry";
import type { WatchLayout } from "./layout";
import { PLACEHOLDER, url, type IdFor } from "./svg";

const LUG_MIRRORS = ["scale(1 1)", "scale(-1 1)", "scale(1 -1)", "scale(-1 -1)"] as const;

/** The 12 o'clock, right-hand lug; the other three are mirrors of it. */
function lugGeometry(layout: WatchLayout): { outline: string; bevel: string } {
  const R = layout.caseR;
  const circleY = (x: number) => -Math.sqrt(Math.max(R * R - x * x, 0));
  const { inner, outer } = layout.lugX;
  const tip = -layout.lugToLug / 2;
  const corner = 0.7;
  // The outer edge flares out where the lug grows from the case side; the root and the inner
  // corner sit just inside the case circle, so the case body hides the seam.
  const rootX = Math.min(outer + 2.4, R - 0.4);
  const rootY = circleY(rootX) + 0.6;
  const innerY = circleY(inner) + 1.5;
  const bend = (tip + rootY) / 2;
  const outline =
    `M${fmt(inner)} ${fmt(innerY)}` +
    `L${fmt(inner)} ${fmt(tip + corner)}` +
    `Q${fmt(inner)} ${fmt(tip)} ${fmt(inner + corner)} ${fmt(tip)}` +
    `L${fmt(outer - corner)} ${fmt(tip)}` +
    `Q${fmt(outer)} ${fmt(tip)} ${fmt(outer)} ${fmt(tip + corner)}` +
    `Q${fmt(outer + 0.4)} ${fmt(bend)} ${fmt(rootX)} ${fmt(rootY)}Z`;
  const bevel =
    `M${fmt(outer - 0.32)} ${fmt(tip + corner)}` + `Q${fmt(outer + 0.08)} ${fmt(bend)} ${fmt(rootX - 0.32)} ${fmt(rootY)}`;
  return { outline, bevel };
}

interface CrownGeometry {
  diameter: number;
  length: number;
  /** Gap between the case edge and the crown; none for the part-recessed 3.8 and 4 o'clock crowns. */
  offset: number;
}

function crownGeometry(watchCase: WatchCase): CrownGeometry {
  const { style } = watchCase;
  return {
    diameter: style === "pilot" ? 6.8 : style === "dress" ? 5 : style === "field" ? 5.6 : 6.2,
    length: watchCase.screwDownCrown ? 3 : 2.5,
    offset: watchCase.crownPosition === 3 ? 0.35 : 0,
  };
}

/** Divers and GMTs with a 3 o'clock crown get shoulders to protect it. */
function hasCrownGuards(watchCase: WatchCase): boolean {
  return watchCase.crownPosition === 3 && (watchCase.style === "diver" || watchCase.style === "gmt");
}

interface CaseLayerProps {
  watchCase?: WatchCase;
  layout: WatchLayout;
  idFor: IdFor;
}

/** Drop shadow, lugs, crown (with guards on divers) and the case body. */
export function CaseLayer({ watchCase, layout, idFor }: CaseLayerProps) {
  const lug = lugGeometry(layout);
  const lugId = idFor("lug");
  const bevelId = idFor("lug-bevel");
  const mirrored = (id: string, props: object) =>
    LUG_MIRRORS.map((transform) => <use key={transform} href={`#${id}`} transform={transform} {...props} />);
  const lugDefs = (
    <defs>
      <path id={lugId} d={lug.outline} />
      <path id={bevelId} d={lug.bevel} />
    </defs>
  );

  if (!watchCase) {
    return (
      <g>
        {lugDefs}
        {mirrored(lugId, PLACEHOLDER)}
        <rect x={fmt(layout.caseR - 0.5)} y="-2.6" width="3.2" height="5.2" rx="0.6" {...PLACEHOLDER} />
        <circle r={fmt(layout.caseR)} {...PLACEHOLDER} fillOpacity={0.8} />
      </g>
    );
  }

  const metal = caseMetal(watchCase.material, watchCase.finish);
  const { finish } = watchCase;
  const polished = finish === "polished" || finish === "brushed & polished";
  const R = layout.caseR;

  return (
    <g>
      {lugDefs}
      <CaseGradients metal={metal} finish={finish} layout={layout} idFor={idFor} />

      <g transform="translate(0.45 1.1)" fill="#000" opacity={0.3} filter={url(idFor("blur-soft"))}>
        <circle r={fmt(R)} />
        {mirrored(lugId, {})}
      </g>

      {mirrored(lugId, { fill: url(idFor("lug-metal")) })}
      {mirrored(lugId, { fill: url(idFor("lug-droop")) })}
      {finish === "bead-blasted" && <g opacity={0.16} filter={url(idFor("grain"))}>{mirrored(lugId, { fill: "#000" })}</g>}
      {finish !== "bead-blasted" &&
        mirrored(bevelId, {
          fill: "none",
          stroke: metal.highlight,
          strokeWidth: 0.3,
          strokeLinecap: "round",
          opacity: polished ? 0.85 : 0.4,
        })}

      <Crown watchCase={watchCase} layout={layout} metal={metal} idFor={idFor} />

      <circle r={fmt(R)} fill={url(idFor("case-body"))} />
      <circle r={fmt(R)} fill={url(idFor("case-relief"))} />
      {finish === "bead-blasted" && <circle r={fmt(R)} fill="#000" opacity={0.16} filter={url(idFor("grain"))} />}
      {(finish === "brushed" || finish === "brushed & polished") && <Brushing layout={layout} />}
      {polished && <circle r={fmt(R - 0.28)} fill="none" stroke={metal.highlight} strokeWidth="0.22" opacity={0.7} />}
      <circle r={fmt(R - 0.05)} fill="none" stroke={metal.edge} strokeWidth="0.1" />
    </g>
  );
}

/** Fine concentric lines on the visible top of the case, the look of a circular brushed finish. */
function Brushing({ layout }: { layout: WatchLayout }) {
  const from = layout.bezel === "none" ? layout.openingR + 0.4 : layout.bezelOuterR;
  const lines: number[] = [];
  for (let r = from + 0.12; r < layout.caseR - 0.35; r += 0.16) lines.push(r);
  return (
    <g fill="none" strokeWidth="0.05">
      {lines.map((r, i) => (
        <circle key={fmt(r)} r={fmt(r)} stroke={i % 2 ? "#fff" : "#000"} opacity={i % 3 === 0 ? 0.1 : 0.05} />
      ))}
    </g>
  );
}

/**
 * Light across the visible top of the case, from its inner edge (0) to the outer edge (1): a mirror
 * polish shows crisp bands of reflected surroundings, brushing a soft sheen, bead-blasting almost none.
 */
const RELIEF: Record<WatchCase["finish"], [number, string, number][]> = {
  polished: [
    [0, "#000", 0.35],
    [0.12, "#fff", 0.55],
    [0.3, "#fff", 0.12],
    [0.55, "#000", 0.22],
    [0.8, "#fff", 0.35],
    [0.93, "#000", 0.08],
    [1, "#000", 0.4],
  ],
  "brushed & polished": [
    [0, "#000", 0.3],
    [0.2, "#fff", 0.25],
    [0.55, "#fff", 0.08],
    [0.85, "#000", 0.06],
    [1, "#000", 0.35],
  ],
  brushed: [
    [0, "#000", 0.25],
    [0.25, "#fff", 0.16],
    [0.6, "#fff", 0.06],
    [0.85, "#000", 0.06],
    [1, "#000", 0.3],
  ],
  "bead-blasted": [
    [0, "#000", 0.22],
    [0.3, "#fff", 0.07],
    [0.8, "#000", 0.05],
    [1, "#000", 0.25],
  ],
  "PVD black": [
    [0, "#000", 0.3],
    [0.25, "#fff", 0.14],
    [0.6, "#fff", 0.04],
    [0.85, "#000", 0.1],
    [1, "#000", 0.35],
  ],
};

function CaseGradients({
  metal,
  finish,
  layout,
  idFor,
}: {
  metal: MetalTone;
  finish: WatchCase["finish"];
  layout: WatchLayout;
  idFor: IdFor;
}) {
  const R = layout.caseR;
  const flat = finish === "bead-blasted";
  const mirror = finish === "polished";
  // The visible top of the case runs from the opening (or bezel) out to the edge; shade it as a curved surface.
  const topStart = Math.min(0.95, (layout.bezel === "none" ? layout.openingR : layout.bezelOuterR) / R);
  const relief = (t: number) => fmt(topStart + (1 - topStart) * t);

  return (
    <defs>
      <linearGradient id={idFor("case-body")} gradientUnits="userSpaceOnUse" x1={fmt(-R)} y1={fmt(-R)} x2={fmt(R)} y2={fmt(R)}>
        <stop offset="0" stopColor={flat ? metal.light : metal.highlight} />
        <stop offset="0.35" stopColor={metal.light} />
        <stop offset="0.6" stopColor={mirror ? metal.shade : metal.mid} />
        <stop offset="0.8" stopColor={mirror ? metal.light : metal.mid} />
        <stop offset="1" stopColor={flat ? metal.mid : metal.shade} />
      </linearGradient>
      <radialGradient id={idFor("case-relief")} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={fmt(R)}>
        {RELIEF[finish].map(([t, color, opacity]) => (
          <stop key={t} offset={relief(t)} stopColor={color} stopOpacity={opacity} />
        ))}
      </radialGradient>
      <linearGradient id={idFor("lug-metal")} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={metal.shade} />
        <stop offset="0.12" stopColor={flat ? metal.mid : metal.light} />
        <stop offset="0.62" stopColor={metal.mid} />
        <stop offset="0.74" stopColor={flat ? metal.mid : metal.highlight} />
        <stop offset="0.86" stopColor={metal.light} />
        <stop offset="1" stopColor={metal.edge} />
      </linearGradient>
      {/* Lugs curve down towards the wrist, so their tips catch less light. */}
      <linearGradient id={idFor("lug-droop")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity={0.3} />
        <stop offset="0.45" stopColor="#000" stopOpacity={0} />
      </linearGradient>
      <linearGradient id={idFor("crown-metal")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={metal.edge} />
        <stop offset="0.25" stopColor={metal.light} />
        <stop offset="0.4" stopColor={flat ? metal.light : metal.highlight} />
        <stop offset="0.65" stopColor={metal.mid} />
        <stop offset="1" stopColor={metal.edge} />
      </linearGradient>
    </defs>
  );
}

function Crown({
  watchCase,
  layout,
  metal,
  idFor,
}: {
  watchCase: WatchCase;
  layout: WatchLayout;
  metal: MetalTone;
  idFor: IdFor;
}) {
  const R = layout.caseR;
  const { diameter, length, offset } = crownGeometry(watchCase);
  const start = R + offset;
  const half = diameter / 2;
  const ridges: number[] = [];
  for (let y = -half + 0.45; y < half - 0.3; y += 0.42) ridges.push(y);
  const knurl = ridges.map((y) => `M${fmt(start + 0.35)} ${fmt(y)}H${fmt(start + length - 0.55)}`).join("");
  const guardInner = half + 0.3;
  const guardReach = R + length * 0.85;
  const guard =
    `M${fmt(R - 1.4)} ${fmt(guardInner)}` +
    `L${fmt(guardReach - 0.8)} ${fmt(guardInner)}` +
    `Q${fmt(guardReach)} ${fmt(guardInner)} ${fmt(guardReach)} ${fmt(guardInner + 0.8)}` +
    `L${fmt(guardReach)} ${fmt(guardInner + 1.3)}` +
    `Q${fmt(guardReach)} ${fmt(guardInner + 2.1)} ${fmt(guardReach - 1.1)} ${fmt(guardInner + 2.6)}` +
    `Q${fmt(R + 0.1)} ${fmt(guardInner + 3.6)} ${fmt(R - 1.4)} ${fmt(guardInner + 4.2)}Z`;

  return (
    <g data-part="crown" transform={`rotate(${fmt(layout.crownDeg - 90)})`}>
      <g transform="translate(0.3 0.6)" fill="#000" opacity={0.28} filter={url(idFor("blur-hand"))}>
        <rect x={fmt(start)} y={fmt(-half)} width={fmt(length)} height={fmt(diameter)} rx="0.55" />
      </g>
      {hasCrownGuards(watchCase) &&
        [1, -1].map((side) => (
          <path key={side} d={guard} transform={`scale(1 ${side})`} fill={url(idFor("lug-metal"))} stroke={metal.edge} strokeWidth="0.08" />
        ))}
      <rect x={fmt(R - 0.8)} y="-1.3" width={fmt(offset + 1.2)} height="2.6" fill={url(idFor("crown-metal"))} />
      <rect
        x={fmt(start)}
        y={fmt(-half)}
        width={fmt(length)}
        height={fmt(diameter)}
        rx="0.55"
        fill={url(idFor("crown-metal"))}
        stroke={metal.edge}
        strokeWidth="0.08"
      />
      <path d={knurl} stroke={metal.edge} strokeWidth="0.1" opacity={0.55} />
      <path
        d={`M${fmt(start + length - 0.45)} ${fmt(-half + 0.35)}V${fmt(half - 0.35)}`}
        stroke={metal.highlight}
        strokeWidth="0.14"
        opacity={0.6}
      />
    </g>
  );
}
