import type { Dial } from "../types";

export type DateWheelColour = "black" | "white";

/** Dials darker than this WCAG relative luminance get a black date wheel. */
const DARK_DIAL_LUMINANCE = 0.2;

/** WCAG relative luminance of a #rgb or #rrggbb colour, or undefined when it can't be read. */
export function relativeLuminance(hex: string): number | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return undefined;
  const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d).join("") : match[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const s = parseInt(digits.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The date (and day) wheel colour to order for a dial: black under a dark dial, white under a light one.
 * The preview draws the same wheel, so the parts list and the picture agree. An unreadable colour
 * counts as dark, as it does in the preview.
 */
export function dateWheelColour(dial: Pick<Dial, "colorHex">): DateWheelColour {
  const luminance = relativeLuminance(dial.colorHex);
  return luminance === undefined || luminance < DARK_DIAL_LUMINANCE ? "black" : "white";
}
