// How parts are summarised in the UI: the few numbers that matter for each kind of part, and the
// colours used for its swatch.
import type { BezelInsert, Complication, CrownPosition, DateWindow, Part, WatchCase } from "@/domain/types";
import { formatMm } from "../ui/format";

const COMPLICATION_LABELS: Record<Complication, string> = { date: "date", day: "day", gmt: "GMT" };

const DATE_WINDOW_LABELS: Record<DateWindow, string> = {
  none: "no date window",
  "date-3": "date at 3",
  "day-date-3": "day-date at 3",
};

const CROWN_LABELS: Record<CrownPosition, string> = { 3: "3", 3.8: "3.8 (SKX)", 4: "4" };

const INSERT_SCALE_LABELS: Record<BezelInsert["scale"], string> = {
  "dive-60": "60-minute dive scale",
  "gmt-24": "24-hour scale",
  "countdown-60": "countdown scale",
  plain: "plain",
};

const AR_LABELS = { none: "no AR coating", inner: "AR inside", both: "AR both sides" } as const;

/** The handful of facts that tell parts of one kind apart, e.g. ["42 mm", "22 mm lugs", "200 m"]. */
export function partHighlights(part: Part): string[] {
  switch (part.category) {
    case "movement":
      return [
        part.caliber,
        part.complications.length > 0
          ? part.complications.map((c) => COMPLICATION_LABELS[c]).join(" + ")
          : "no date",
        `${part.powerReserveHours} h reserve`,
        `${part.jewels} jewels`,
      ];
    case "case":
      return [
        formatMm(part.diameterMm),
        `${formatMm(part.lugToLugMm)} lug to lug`,
        `${formatMm(part.thicknessMm)} thick`,
        `${formatMm(part.lugWidthMm)} lugs`,
        `${part.waterResistanceM} m`,
      ];
    case "dial":
      return [
        formatMm(part.diameterMm),
        DATE_WINDOW_LABELS[part.dateWindow],
        `crown at ${CROWN_LABELS[part.crownPosition]}`,
        part.lume === "none" ? "no lume" : `${part.lume} lume`,
      ];
    case "hands":
      return [
        part.style,
        part.includesGmt ? "4 hands with GMT" : "3 hands",
        part.lume === "none" ? "no lume" : `${part.lume} lume`,
      ];
    case "crystal":
      return [part.material, part.shape, formatMm(part.diameterMm), AR_LABELS[part.arCoating]];
    case "bezelInsert":
      return [INSERT_SCALE_LABELS[part.scale], part.material, `${part.outerMm} × ${part.innerMm} mm`];
    case "strap":
      return [part.type, formatMm(part.widthMm)];
  }
}

export interface Swatch {
  base: string;
  /** Second half of a two-tone part, such as a GMT bezel. */
  split?: string;
  /** Small centre dot: dial print or seconds-hand colour. */
  accent?: string;
}

function metalTone(watchCase: WatchCase): string {
  if (watchCase.finish === "PVD black") return "#2a2a2c";
  if (watchCase.material === "bronze") return "#a8743f";
  if (watchCase.material === "titanium") return "#9ca0a4";
  return watchCase.finish === "polished" ? "#d9dbde" : "#c2c5c9";
}

/** Colours for a part's swatch, or null for parts whose colour isn't a choice (movement, crystal). */
export function partSwatch(part: Part): Swatch | null {
  switch (part.category) {
    case "case":
      return { base: metalTone(part) };
    case "dial":
      return { base: part.colorHex, accent: part.printColorHex };
    case "hands":
      return { base: part.colorHex, accent: part.secondsColorHex };
    case "bezelInsert":
      return { base: part.colorHex, split: part.secondaryColorHex };
    case "strap":
      return { base: part.colorHex };
    case "movement":
    case "crystal":
      return null;
  }
}
