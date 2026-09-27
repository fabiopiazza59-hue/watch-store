// Where a dial's printed zones sit and how much personal text fits between its hour markers. The
// preview draws the dial from these numbers and the rules engine warns from them, so the picture
// and the "too long to print legibly" warning can't disagree. Pure: no React, no DOM.
import { relativeLuminance } from "./catalog/dateWheel";
import type { Dial } from "./types";

/** Dial print sizes on a standard 28.5mm dial, in mm; they scale with the dial's diameter. */
export const DIAL_PRINT_MM = {
  standardDial: 28.5,
  markerLength: 2.9,
  romanSize: 2.2,
  arabicSize: 2.6,
  /** Pilot dials print larger numerals. */
  pilotArabicSize: 3.1,
  /** Ring of lume dots printed outside arabic numerals that aren't lumed themselves. */
  lumeDotRing: 1.1,
  /** Dial text's full font size. */
  textSize: 1.15,
} as const;

/**
 * Dial text shrinks to fit between the markers, down to this share of its full size (a cap height
 * of about 0.5mm on a standard dial, as small as dial print goes). Anything longer would have to be
 * printed smaller still, which is where the rules engine warns.
 */
export const MIN_DIAL_TEXT_SCALE = 0.65;

/** Numerals whose print is lighter than this are lumed themselves; darker ones get lume dots. */
const LUMED_NUMERAL_LUMINANCE = 0.45;
const LIGHT_PRINT = "#f2f2ee";
const DARK_PRINT = "#1c1c1c";
const DARK_DIAL_LUMINANCE = 0.2;

/** Radii of the printed zones, from the edge of the dial inwards. */
export interface DialPrintZones {
  /** Dial diameter relative to the standard 28.5mm; print sizes scale by it. */
  s: number;
  dialR: number;
  track?: { outer: number; inner: number };
  scale24?: { outer: number; inner: number };
  /** Outer end of the hour markers. */
  indexOuter: number;
}

/**
 * The printed zones of a dial of `dialDiameterMm`. Under a chapter ring the dial's outer 0.6mm is
 * hidden and the minute track lives on the ring; otherwise the dial carries it.
 */
export function dialPrintZones(dialDiameterMm: number, has24hScale: boolean, chapterRing: boolean): DialPrintZones {
  const dialR = dialDiameterMm / 2;
  const s = dialDiameterMm / DIAL_PRINT_MM.standardDial;
  const edge = chapterRing ? dialR - 0.6 : dialR;
  const track = chapterRing ? undefined : { outer: edge - 0.35 * s, inner: edge - 1.5 * s };
  let next = track ? track.inner - 0.4 * s : edge - 0.4 * s;
  let scale24;
  if (has24hScale) {
    scale24 = { outer: next, inner: next - 1.6 * s };
    next = scale24.inner - 0.35 * s;
  }
  return { s, dialR, track, scale24, indexOuter: next };
}

/** The dial's print colour as drawn: its own when readable, else light on a dark dial and dark on a light one. */
function printLuminance(dial: Pick<Dial, "colorHex" | "printColorHex">): number {
  const own = relativeLuminance(dial.printColorHex);
  if (own !== undefined) return own;
  const base = relativeLuminance(dial.colorHex);
  const darkDial = base === undefined || base < DARK_DIAL_LUMINANCE;
  return relativeLuminance(darkDial ? LIGHT_PRINT : DARK_PRINT) ?? 0;
}

/** Lumed arabic numerals printed in a dark colour carry a ring of lume dots outside them instead. */
export function numeralLumeDots(dial: Pick<Dial, "lume" | "colorHex" | "printColorHex">): boolean {
  return dial.lume !== "none" && printLuminance(dial) <= LUMED_NUMERAL_LUMINANCE;
}

export function arabicNumeralSize(dial: Pick<Dial, "style">, s: number): number {
  return (dial.style === "pilot" ? DIAL_PRINT_MM.pilotArabicSize : DIAL_PRINT_MM.arabicSize) * s;
}

type IndexDial = Pick<Dial, "indices" | "style" | "lume" | "colorHex" | "printColorHex">;

/** Radius where the hour markers end towards the centre: the dial text sits inside it. */
export function indexInnerRadius(dial: IndexDial, zones: DialPrintZones): number {
  const { s, indexOuter } = zones;
  switch (dial.indices) {
    case "arabic":
      return indexOuter - arabicNumeralSize(dial, s) * 1.25 - (numeralLumeDots(dial) ? DIAL_PRINT_MM.lumeDotRing * s : 0);
    case "roman":
      return indexOuter - DIAL_PRINT_MM.romanSize * s;
    default:
      return indexOuter - DIAL_PRINT_MM.markerLength * s;
  }
}

export interface DialTextLayout {
  /** Distance of the line's centre below the dial centre, mm. */
  y: number;
  /** Width available between the markers either side, with a margin, mm. */
  available: number;
  /** Width of the line at full size, mm. */
  fullWidth: number;
  /** Share of full size it is printed at: between MIN_DIAL_TEXT_SCALE and 1. */
  scale: number;
  fontSize: number;
  letterSpacing: number;
  /** False when the line would need to be printed below MIN_DIAL_TEXT_SCALE to fit. */
  legible: boolean;
  /** The most characters that fit at MIN_DIAL_TEXT_SCALE. */
  maxLegibleCharacters: number;
}

const CHARACTER_WIDTH = DIAL_PRINT_MM.textSize * 0.68;
const LETTER_SPACING = 0.2;

/** How a line of `characters` characters is set above 6 o'clock, inside the markers ending at `indexInner`. */
export function layoutDialText(indexInner: number, s: number, characters: number): DialTextLayout {
  const y = indexInner * 0.66;
  const available = 2 * Math.sqrt(Math.max(indexInner * indexInner - y * y, 0)) * 0.8;
  const fullWidth = (characters * CHARACTER_WIDTH + Math.max(characters - 1, 0) * LETTER_SPACING) * s;
  const fit = fullWidth > 0 ? available / fullWidth : 1;
  const scale = Math.min(1, Math.max(MIN_DIAL_TEXT_SCALE, fit));
  const maxLegibleCharacters = Math.max(
    0,
    Math.floor((available / (MIN_DIAL_TEXT_SCALE * s) + LETTER_SPACING) / (CHARACTER_WIDTH + LETTER_SPACING) + 1e-9),
  );
  return {
    y,
    available,
    fullWidth,
    scale,
    fontSize: DIAL_PRINT_MM.textSize * s * scale,
    letterSpacing: LETTER_SPACING * s * scale,
    legible: fit >= MIN_DIAL_TEXT_SCALE,
    maxLegibleCharacters,
  };
}

/** The line as printed: trimmed, in capitals. Its length is what has to fit. */
export function dialTextLine(text: string): string {
  return text.trim().toUpperCase();
}

/** How `text` would be set on `dial`, in a case with or without a chapter ring. */
export function fitDialText(dial: IndexDial & Pick<Dial, "diameterMm" | "has24hScale">, chapterRing: boolean, text: string): DialTextLayout {
  const zones = dialPrintZones(dial.diameterMm, dial.has24hScale, chapterRing);
  return layoutDialText(indexInnerRadius(dial, zones), zones.s, dialTextLine(text).length);
}
