import type { BezelType, CrownPosition, ResolvedSpec, WatchCase } from "@/domain/types";
import { clamp, positive } from "./geometry";

/** Proportions used when the case is missing, so the other parts still have somewhere to sit. */
const FALLBACK_CASE = {
  diameterMm: 40,
  lugToLugMm: 47,
  lugWidthMm: 20,
  dialDiameterMm: 28.5,
  crystalDiameterMm: 30.5,
} as const;

/** Half the viewBox side. Fixed for every normal case size, so different designs render at the same true scale. */
const VIEW_HALF_MM = 30;

/** Radii and positions shared by every layer, derived from the case (or fallbacks). */
export interface WatchLayout {
  /** Half-width of the square viewBox. */
  viewHalf: number;
  caseR: number;
  lugToLug: number;
  lugWidth: number;
  /** Where the right-hand lugs sit across the watch: inner edge beside the strap, outer edge at the tip. */
  lugX: { inner: number; outer: number };
  /** Crown direction, degrees clockwise from 12. */
  crownDeg: number;
  /**
   * How far the dial sits turned in this case, degrees clockwise. Zero when the dial is made for
   * the case's crown position; otherwise its feet hold it turned by the difference (a 3.8 dial in a
   * 3 o'clock case sits 24° anticlockwise), which is exactly what the rules engine rejects.
   */
  dialTurnDeg: number;
  bezel: BezelType;
  /** Outer radius of a rotating or fixed bezel. */
  bezelOuterR: number;
  /** The case's seat for a bezel insert, when it takes one. */
  insertSeat?: { innerR: number; outerR: number };
  /** Radius of the window through which crystal, chapter ring and dial are seen. */
  openingR: number;
  /** Sloped chapter ring (rehaut) between the dial edge and the opening. */
  chapterRing?: { innerR: number; outerR: number };
  dialSeatR: number;
  crystalSeatR: number;
}

function takesInsert(bezel: BezelType): boolean {
  return bezel === "unidirectional-120" || bezel === "bidirectional-24h";
}

/** 3 o'clock = 90°, 3.8 ≈ 114°, 4 = 120°. */
function crownAngle(position: CrownPosition | undefined): number {
  return positive(position, 3) * 30;
}

export function computeLayout(parts: ResolvedSpec): WatchLayout {
  const watchCase: Partial<WatchCase> = parts.case ?? {};
  const caseR = positive(watchCase.diameterMm, FALLBACK_CASE.diameterMm) / 2;
  const lugToLug = positive(watchCase.lugToLugMm, FALLBACK_CASE.lugToLugMm);
  const lugWidth = positive(watchCase.lugWidthMm, positive(parts.strap?.widthMm, FALLBACK_CASE.lugWidthMm));
  const dialSeatR = positive(watchCase.dialDiameterMm, positive(parts.dial?.diameterMm, FALLBACK_CASE.dialDiameterMm)) / 2;
  const crystalSeatR = positive(watchCase.crystalDiameterMm, FALLBACK_CASE.crystalDiameterMm) / 2;
  const bezel: BezelType = watchCase.bezel ?? "none";

  const insertSeat =
    takesInsert(bezel) && watchCase.insertMm
      ? {
          innerR: positive(watchCase.insertMm.inner, crystalSeatR * 2) / 2,
          outerR: positive(watchCase.insertMm.outer, caseR * 2 - 3) / 2,
        }
      : undefined;

  // The window onto the dial: the insert seat's inner edge, or the lip of case/bezel over the crystal.
  const openingR = insertSeat ? insertSeat.innerR : crystalSeatR - (bezel === "fixed" ? 0.45 : 0.3);

  const chapterInnerR = dialSeatR - 0.6;
  const chapterRing =
    watchCase.chapterRing && openingR - chapterInnerR > 0.2 ? { innerR: chapterInnerR, outerR: openingR } : undefined;

  return {
    viewHalf: Math.max(VIEW_HALF_MM, lugToLug / 2 + 5.5, caseR + 8),
    caseR,
    lugToLug,
    lugWidth,
    lugX: { inner: lugWidth / 2 + 0.15, outer: lugWidth / 2 + 0.15 + clamp((caseR - lugWidth / 2) * 0.38, 2.2, 3.4) },
    crownDeg: crownAngle(watchCase.crownPosition),
    dialTurnDeg: parts.case && parts.dial ? crownAngle(parts.case.crownPosition) - crownAngle(parts.dial.crownPosition) : 0,
    bezel,
    bezelOuterR: caseR - (bezel === "fixed" ? 0.55 : 0.25),
    insertSeat,
    openingR,
    chapterRing,
    dialSeatR,
    crystalSeatR,
  };
}
