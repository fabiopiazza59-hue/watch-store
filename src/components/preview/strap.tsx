import type { ReactNode } from "react";
import type { Strap } from "@/domain/types";
import { colorName, darken, lighten, metalFrom, safeHex } from "./color";
import { fmt, polygon, positive } from "./geometry";
import type { WatchLayout } from "./layout";
import { PLACEHOLDER, url, type IdFor } from "./svg";

/** Straps narrow towards the buckle; this is the taper per millimetre of length. */
const TAPER_PER_MM = 0.05;

interface StubGeometry {
  /** Width at the spring bar, tucked under the case. */
  width: number;
  /** Width where the stub leaves the view. */
  endWidth: number;
  /** y where the stub starts under the case (negative: the 12 o'clock side). */
  start: number;
  end: number;
  /** y of the lug tips, where the visible strap begins. */
  lugTip: number;
}

function stubGeometry(width: number, layout: WatchLayout): StubGeometry {
  const start = -(layout.caseR - 1.5);
  const end = -layout.viewHalf - 0.5;
  return { width, endWidth: width - (start - end) * TAPER_PER_MM, start, end, lugTip: -layout.lugToLug / 2 };
}

/** Half-width of the stub at height y. */
function halfWidthAt(g: StubGeometry, y: number): number {
  const t = (g.start - y) / (g.start - g.end);
  return (g.width + (g.endWidth - g.width) * t) / 2;
}

/** The stub's outline between two heights. */
function outline(g: StubGeometry, from = g.start, to = g.end): string {
  return polygon([
    [halfWidthAt(g, from), from],
    [halfWidthAt(g, to), to],
    [-halfWidthAt(g, to), to],
    [-halfWidthAt(g, from), from],
  ]);
}

/** Stitch lines inset from both long edges. */
function stitches(g: StubGeometry, inset: number): string {
  return [1, -1]
    .map((side) => `M${fmt(side * (halfWidthAt(g, g.start) - inset))} ${fmt(g.start)}L${fmt(side * (halfWidthAt(g, g.end) - inset))} ${fmt(g.end)}`)
    .join("");
}

interface StrapLayerProps {
  strap?: Strap;
  layout: WatchLayout;
  idFor: IdFor;
}

/**
 * Strap stubs above and below the case, fading out towards the edge of the view. The 12 o'clock
 * stub is drawn once and mirrored for 6 o'clock.
 */
export function StrapLayer({ strap, layout, idFor }: StrapLayerProps) {
  const width = positive(strap?.widthMm, layout.lugWidth);
  const g = stubGeometry(width, layout);
  const half = layout.viewHalf;
  // Fully visible just beyond the lug tips, gone at the view edge.
  const fadeEnd = (half + g.lugTip - 1) / (2 * half);

  const stub = strap ? (
    <StrapStub strap={strap} g={g} idFor={idFor} />
  ) : (
    <path d={outline(g)} {...PLACEHOLDER} />
  );

  return (
    <g>
      <defs>
        <linearGradient id={idFor("strap-fade")} gradientUnits="userSpaceOnUse" x1="0" y1={fmt(-half)} x2="0" y2={fmt(half)}>
          <stop offset="0" stopColor="#000" />
          <stop offset={fmt(fadeEnd * 0.55)} stopColor="#777" />
          <stop offset={fmt(fadeEnd)} stopColor="#fff" />
          <stop offset={fmt(1 - fadeEnd)} stopColor="#fff" />
          <stop offset={fmt(1 - fadeEnd * 0.55)} stopColor="#777" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={idFor("strap-mask")} maskUnits="userSpaceOnUse" x={fmt(-half)} y={fmt(-half)} width={fmt(half * 2)} height={fmt(half * 2)}>
          <rect x={fmt(-half)} y={fmt(-half)} width={fmt(half * 2)} height={fmt(half * 2)} fill={url(idFor("strap-fade"))} />
        </mask>
        <g id={idFor("strap-stub")}>{stub}</g>
      </defs>
      <g mask={url(idFor("strap-mask"))}>
        <use href={`#${idFor("strap-stub")}`} />
        <use href={`#${idFor("strap-stub")}`} transform="scale(1 -1)" />
      </g>
    </g>
  );
}

function StrapStub({ strap, g, idFor }: { strap: Strap; g: StubGeometry; idFor: IdFor }) {
  const base = safeHex(strap.colorHex, "#5a5a5a");
  if (strap.type === "bracelet") return <BraceletStub base={base} g={g} idFor={idFor} />;

  const edgeId = idFor("strap-edge");
  const body = outline(g);
  let texture: ReactNode = null;

  switch (strap.type) {
    case "leather": {
      const tonal = ["black", "graphite", "navy"].includes(colorName(base));
      texture = (
        <>
          <path d={body} fill="#000" opacity={0.2} filter={url(idFor("grain"))} />
          <path
            d={stitches(g, 1.05)}
            stroke={tonal ? lighten(base, 0.3) : "#e8dcc2"}
            strokeWidth={0.22}
            strokeDasharray="0.95 0.55"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
      break;
    }
    case "rubber":
      texture = <RubberVents base={base} g={g} />;
      break;
    case "nato":
      texture = (
        <>
          <defs>
            <pattern id={idFor("nato-weave")} patternUnits="userSpaceOnUse" width="1" height="0.34">
              <rect width="1" height="0.14" fill="#000" opacity={0.16} />
              <rect y="0.17" width="1" height="0.05" fill="#fff" opacity={0.07} />
            </pattern>
          </defs>
          <path d={body} fill={url(idFor("nato-weave"))} />
          <path d={stitches(g, 0.75)} stroke={darken(base, 0.3)} strokeWidth={0.14} fill="none" />
          <path d={stitches(g, 0.95)} stroke={lighten(base, 0.12)} strokeWidth={0.08} fill="none" opacity={0.6} />
        </>
      );
      break;
    case "canvas":
      texture = (
        <>
          <defs>
            <pattern id={idFor("canvas-weave")} patternUnits="userSpaceOnUse" width="0.44" height="0.44">
              <path d="M0 0.44L0.44 0M-0.11 0.11L0.11 -0.11M0.33 0.55L0.55 0.33" stroke="#000" strokeWidth="0.09" opacity={0.2} />
              <path d="M0 0L0.44 0.44" stroke="#fff" strokeWidth="0.06" opacity={0.12} />
            </pattern>
          </defs>
          <path d={body} fill={url(idFor("canvas-weave"))} />
          <path
            d={stitches(g, 0.9)}
            stroke={darken(base, 0.35)}
            strokeWidth={0.2}
            strokeDasharray="0.8 0.5"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
      break;
  }

  return (
    <g>
      <defs>
        <linearGradient id={edgeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(base, 0.38)} />
          <stop offset="0.07" stopColor={darken(base, 0.06)} />
          <stop offset="0.45" stopColor={lighten(base, 0.07)} />
          <stop offset="0.93" stopColor={darken(base, 0.1)} />
          <stop offset="1" stopColor={darken(base, 0.42)} />
        </linearGradient>
      </defs>
      <path d={body} fill={url(edgeId)} />
      {texture}
    </g>
  );
}

/** Pill-shaped vents running down the centre of a dive strap. */
function RubberVents({ base, g }: { base: string; g: StubGeometry }) {
  const pitch = 2.3;
  const ventWidth = g.width * 0.42;
  const rows: number[] = [];
  for (let y = g.lugTip - 1.8; y > g.end; y -= pitch) rows.push(y);
  return (
    <g>
      {rows.map((y) => (
        <g key={fmt(y)}>
          <rect x={fmt(-ventWidth / 2)} y={fmt(y - 0.45)} width={fmt(ventWidth)} height="0.9" rx="0.45" fill={darken(base, 0.55)} />
          <path
            d={`M${fmt(-ventWidth / 2 + 0.45)} ${fmt(y + 0.47)}H${fmt(ventWidth / 2 - 0.45)}`}
            stroke={lighten(base, 0.2)}
            strokeWidth="0.1"
            opacity={0.6}
          />
        </g>
      ))}
    </g>
  );
}

/** Share of a bracelet row taken by each outer link; the polished centre link takes the rest. */
const OUTER_LINK_SHARE = 0.31;

/** Three-link bracelet: a solid end link between the lugs, then rows of brushed links. */
function BraceletStub({ base, g, idFor }: { base: string; g: StubGeometry; idFor: IdFor }) {
  const tone = metalFrom(base);
  const brushedId = idFor("bracelet-brushed");
  const polishedId = idFor("bracelet-polished");
  const gap = 0.28;
  const pitch = 3.5;
  const endLinkOuter = g.lugTip + 0.6;

  const rows: { top: number; bottom: number }[] = [];
  for (let bottom = endLinkOuter - gap; bottom > g.end; bottom -= pitch) {
    rows.push({ bottom, top: bottom - pitch + gap });
  }

  // The solid end link is milled to look like the first row of links.
  const grooveX = (y: number) => halfWidthAt(g, y) * (1 - 2 * OUTER_LINK_SHARE) - gap / 2;
  const endLinkGrooves = [1, -1]
    .map((side) => `M${fmt(side * grooveX(g.start))} ${fmt(g.start)}L${fmt(side * grooveX(endLinkOuter))} ${fmt(endLinkOuter)}`)
    .join("");

  return (
    <g>
      <defs>
        <linearGradient id={brushedId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tone.shade} />
          <stop offset="0.2" stopColor={tone.light} />
          <stop offset="0.7" stopColor={tone.mid} />
          <stop offset="1" stopColor={tone.edge} />
        </linearGradient>
        <linearGradient id={polishedId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tone.edge} />
          <stop offset="0.3" stopColor={tone.highlight} />
          <stop offset="0.55" stopColor={tone.mid} />
          <stop offset="0.8" stopColor={tone.light} />
          <stop offset="1" stopColor={tone.edge} />
        </linearGradient>
      </defs>
      <path d={outline(g, g.start, endLinkOuter)} fill={url(brushedId)} />
      <path d={endLinkGrooves} stroke={tone.edge} strokeWidth="0.14" opacity={0.6} />
      {rows.map(({ top, bottom }) => {
        const w = halfWidthAt(g, (top + bottom) / 2) * 2;
        const outer = w * OUTER_LINK_SHARE;
        const centre = w - 2 * outer - 2 * gap;
        const height = bottom - top;
        return (
          <g key={fmt(bottom)}>
            <rect x={fmt(-w / 2)} y={fmt(top)} width={fmt(outer)} height={fmt(height)} rx="0.5" fill={url(brushedId)} />
            <rect x={fmt(-centre / 2)} y={fmt(top)} width={fmt(centre)} height={fmt(height)} rx="0.5" fill={url(polishedId)} />
            <rect x={fmt(w / 2 - outer)} y={fmt(top)} width={fmt(outer)} height={fmt(height)} rx="0.5" fill={url(brushedId)} />
          </g>
        );
      })}
    </g>
  );
}
