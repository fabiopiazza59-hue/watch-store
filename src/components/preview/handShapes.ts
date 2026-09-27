// Hand outlines, drawn pointing to 12 with the pivot at the origin (the hand's tip is at y = -length).
// Widths scale with length, so the larger hand sets for 33.5mm dials keep their proportions.

import type { HandStyle } from "@/domain/types";
import { circle, ellipse, fmt, symmetric, type Point } from "./geometry";

export interface HandShape {
  /** Metal body: one path whose subpaths union under the non-zero fill rule. */
  body: string;
  /** Lume inlay, drawn over the body. */
  lume?: string;
  /** Metal detail drawn over the lume (Mercedes spokes, cathedral tracery), as a stroked path. */
  detail?: { d: string; width: number };
  /** Darker half of a faceted hand, drawn over the body. */
  facet?: string;
}

/** Where a straight hand edge from (x0, y0) to (x1, y1) sits at height y. */
function edgeX([x0, y0]: Point, [x1, y1]: Point, y: number): number {
  return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
}

/** Leaf-shaped hand, widest at `shoulder` (fraction of length), with a lume inlay. */
function sword(length: number, width: number, baseHalf: number, shoulder: number, inset: number): HandShape {
  const base: Point = [baseHalf, 0];
  const widest: Point = [width / 2, -shoulder * length];
  const tip: Point = [0, -length];
  const lumeStart = -0.2 * length;
  const tipAngle = Math.atan2(width / 2, length * (1 - shoulder));
  return {
    body: symmetric([base, widest, tip]),
    lume: symmetric([
      [edgeX(base, widest, lumeStart) - inset, lumeStart],
      [width / 2 - inset, -shoulder * length],
      [0, -length + inset / Math.sin(tipAngle)],
    ]),
  };
}

function dauphine(length: number, width: number, baseHalf: number): HandShape {
  const right: Point[] = [
    [baseHalf, 0],
    [width / 2, -0.22 * length],
    [0, -length],
  ];
  return {
    body: symmetric(right),
    facet: `M0 0L${right.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}Z`,
  };
}

function baton(length: number, width: number, inset: number): HandShape {
  return {
    body: symmetric([
      [width / 2, 0],
      [width / 2, -length],
      [0, -length],
    ]),
    lume: symmetric([
      [width / 2 - inset, -0.22 * length],
      [width / 2 - inset, -length + inset * 1.5],
      [0, -length + inset * 1.5],
    ]),
  };
}

function syringe(length: number, width: number, barrelEnd: number, k: number): HandShape {
  const inset = 0.2 * k;
  return {
    body: symmetric([
      [width / 2, 0],
      [width / 2, -barrelEnd * length],
      [0.14 * k, -(barrelEnd + 0.07) * length],
      [0.12 * k, -length + 0.25 * k],
      [0, -length],
    ]),
    lume: symmetric([
      [width / 2 - inset, -0.16 * length],
      [width / 2 - inset, -barrelEnd * length + inset],
      [0, -barrelEnd * length + inset],
    ]),
  };
}

function hourCathedral(length: number, k: number): HandShape {
  const L = length;
  const stem = 0.36 * k;
  const chest = 1.12 * k;
  const waist = 0.4 * k;
  const crown = 0.74 * k;
  const right =
    `M${fmt(stem)} 0L${fmt(stem)} ${fmt(-0.2 * L)}` +
    `Q${fmt(chest)} ${fmt(-0.24 * L)} ${fmt(chest)} ${fmt(-0.42 * L)}` +
    `Q${fmt(chest)} ${fmt(-0.6 * L)} ${fmt(waist)} ${fmt(-0.66 * L)}` +
    `L${fmt(crown)} ${fmt(-0.77 * L)}L0 ${fmt(-L)}`;
  const left =
    `L${fmt(-crown)} ${fmt(-0.77 * L)}L${fmt(-waist)} ${fmt(-0.66 * L)}` +
    `Q${fmt(-chest)} ${fmt(-0.6 * L)} ${fmt(-chest)} ${fmt(-0.42 * L)}` +
    `Q${fmt(-chest)} ${fmt(-0.24 * L)} ${fmt(-stem)} ${fmt(-0.2 * L)}L${fmt(-stem)} 0Z`;
  const chamberY = -0.43 * L;
  const chamberRx = chest - 0.3 * k;
  const chamberRy = 0.14 * L;
  const lozenge = crown - 0.3 * k;
  return {
    body: right + left,
    lume:
      ellipse(chamberRx, chamberRy, 0, chamberY) +
      `M0 ${fmt(-0.7 * L)}L${fmt(lozenge)} ${fmt(-0.775 * L)}L0 ${fmt(-0.92 * L)}L${fmt(-lozenge)} ${fmt(-0.775 * L)}Z`,
    detail: {
      d:
        `M0 ${fmt(chamberY - chamberRy)}V${fmt(chamberY + chamberRy)}` +
        `M${fmt(-chamberRx)} ${fmt(chamberY)}H${fmt(chamberRx)}`,
      width: 0.16 * k,
    },
  };
}

function minuteCathedral(length: number, k: number): HandShape {
  const L = length;
  const stem = 0.3 * k;
  const chest = 0.7 * k;
  const right: Point[] = [
    [stem, 0],
    [stem, -0.16 * L],
    [chest, -0.26 * L],
    [0.26 * k, -0.86 * L],
    [0, -L],
  ];
  return {
    body: symmetric(right),
    lume: symmetric([
      [chest - 0.28 * k, -0.27 * L],
      [0.1 * k, -0.84 * L],
      [0, -L + 1.1 * k],
    ]),
  };
}

function mercedes(length: number, k: number): HandShape {
  const L = length;
  const cy = -0.64 * L;
  const outer = 1.3 * k;
  const inner = outer - 0.26 * k;
  const stem = 0.42 * k;
  const tipBase = cy - outer * 0.55;
  const spoke = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `M0 ${fmt(cy)}L${fmt(inner * Math.sin(rad))} ${fmt(cy - inner * Math.cos(rad))}`;
  };
  return {
    body:
      symmetric([
        [stem, 0],
        [stem, cy],
        [0, cy],
      ]) +
      circle(outer, 0, cy) +
      symmetric([
        [0.85 * k, tipBase],
        [0, -L],
      ]),
    lume:
      circle(inner, 0, cy) +
      symmetric([
        [0.5 * k, cy - outer - 0.05 * k],
        [0, -L + 0.7 * k],
      ]),
    detail: { d: spoke(0) + spoke(120) + spoke(240), width: 0.26 * k },
  };
}

function snowflake(length: number, k: number): HandShape {
  const L = length;
  const width = 2.3 * k;
  const inset = 0.24 * k;
  return {
    body:
      symmetric([
        [0.38 * k, 0],
        [0.38 * k, -0.44 * L],
        [0, -0.44 * L],
      ]) +
      symmetric([
        [width / 2, -0.42 * L],
        [width / 2, -0.8 * L],
        [0, -L],
      ]),
    lume: symmetric([
      [width / 2 - inset, -0.42 * L - inset],
      [width / 2 - inset, -0.8 * L + inset * 0.3],
      [0, -L + inset * 2.2],
    ]),
  };
}

function broadArrow(length: number, k: number): HandShape {
  const L = length;
  return {
    body: symmetric([
      [0.4 * k, 0],
      [0.4 * k, -0.56 * L],
      [1.35 * k, -0.5 * L],
      [0, -L],
    ]),
    lume:
      symmetric([
        [0.2 * k, -0.15 * L],
        [0.2 * k, -0.52 * L],
        [0, -0.52 * L],
      ]) +
      symmetric([
        [0.82 * k, -0.535 * L],
        [0, -L + 0.95 * k],
      ]),
  };
}

/** Hour hand for each style. `k` scales widths to the hand's length (1 for an 8.5mm hand). */
export function hourHand(style: HandStyle, length: number): HandShape {
  const k = length / 8.5;
  switch (style) {
    case "sword":
      return sword(length, 1.9 * k, 0.45 * k, 0.3, 0.22 * k);
    case "mercedes":
      return mercedes(length, k);
    case "dauphine":
      return dauphine(length, 1.8 * k, 0.45 * k);
    case "baton":
      return baton(length, 1.2 * k, 0.24 * k);
    case "snowflake":
      return snowflake(length, k);
    case "syringe":
      return syringe(length, 1.25 * k, 0.7, k);
    case "cathedral":
      return hourCathedral(length, k);
    case "arrow":
      return broadArrow(length, k);
  }
}

/** Minute hand for each style; most sets pair a decorative hour hand with a sword minute hand. */
export function minuteHand(style: HandStyle, length: number): HandShape {
  const k = length / 12.5;
  switch (style) {
    case "dauphine":
      return dauphine(length, 1.35 * k, 0.35 * k);
    case "baton":
      return baton(length, 0.95 * k, 0.22 * k);
    case "syringe":
      return syringe(length, 1.0 * k, 0.76, k);
    case "cathedral":
      return minuteCathedral(length, k);
    case "sword":
      return sword(length, 1.4 * k, 0.35 * k, 0.28, 0.2 * k);
    case "mercedes":
    case "snowflake":
    case "arrow":
      return sword(length, 1.2 * k, 0.32 * k, 0.26, 0.2 * k);
  }
}

/** The NH34's 24-hour hand: a slim stem with an arrow tip. */
export function gmtHand(length: number): HandShape {
  const k = length / 12;
  const L = length;
  return {
    body: symmetric([
      [0.17 * k, 0],
      [0.17 * k, -(L - 2 * k)],
      [0.9 * k, -(L - 1.85 * k)],
      [0, -L],
    ]),
    lume: symmetric([
      [0.5 * k, -(L - 1.95 * k)],
      [0, -(L - 0.75 * k)],
    ]),
  };
}

/** Seconds hand: a needle with a counterweight tail; diver styles carry a lume "lollipop". */
export function secondsHand(style: HandStyle, length: number): HandShape {
  const L = length;
  const needle = symmetric([
    [0.13, 0.26 * L],
    [0.11, -0.2 * L],
    [0.05, -L + 0.2],
    [0, -L],
  ]);
  const lollipop = style === "mercedes" || style === "sword" || style === "snowflake";
  if (lollipop) {
    return {
      body: needle + circle(0.62, 0, -0.76 * L) + circle(0.5, 0, 0.24 * L),
      lume: circle(0.46, 0, -0.76 * L),
    };
  }
  return {
    body:
      needle +
      symmetric([
        [0.3, 0.3 * L],
        [0.3, 0.1 * L],
        [0, 0.1 * L],
      ]),
  };
}
