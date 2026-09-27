import type { LumeColor, WatchCase } from "@/domain/types";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A valid 6-digit lowercase hex colour, or the fallback. */
export function safeHex(value: string | undefined, fallback: string): string {
  if (!value || !HEX.test(value)) return fallback;
  const hex = value.toLowerCase();
  return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
}

function channels(hex: string): [number, number, number] {
  const value = parseInt(safeHex(hex, "#808080").slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

/** Blend `a` towards `b` by `t` (0 = a, 1 = b). */
function mix(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return toHex(ca.map((c, i) => c + (cb[i] - c) * t));
}

export const lighten = (hex: string, t: number) => mix(hex, "#ffffff", t);
export const darken = (hex: string, t: number) => mix(hex, "#000000", t);

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const isDark = (hex: string) => luminance(hex) < 0.2;

function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = channels(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h, s, l };
}

/** Plain-English colour word for a hex value ("navy", "olive", "cream"), used in the aria label. */
export function colorName(hex: string): string {
  const { h, s, l } = hsl(hex);
  if (l < 0.12) return "black";
  if (l > 0.93) return "white";
  if (s < 0.12) {
    if (l > 0.72) return "silver";
    if (l > 0.33) return "grey";
    return l > 0.15 ? "graphite" : "black";
  }
  if (h >= 36 && h < 55 && s > 0.35 && l > 0.4 && l < 0.7) return "gold";
  if (l > 0.85 && h >= 25 && h < 70) return "cream";
  if (h < 15 || h >= 340) return l < 0.3 ? "burgundy" : "red";
  if (h < 36) {
    if (l < 0.35) return "brown";
    return s > 0.5 ? "orange" : "tan";
  }
  if (h < 65) {
    if (l > 0.65) return "sand";
    return l < 0.3 ? "olive" : "khaki";
  }
  if (h < 90) return "olive";
  if (h < 165) return "green";
  if (h < 200) return "teal";
  if (h < 255) return l < 0.2 ? "navy" : "blue";
  if (h < 290) return "purple";
  return "pink";
}

/** How lume paint looks in daylight: an off-white tinted by its glow colour. */
export function lumeDayColor(lume: LumeColor | undefined): string | undefined {
  switch (lume) {
    case "green":
      return "#eef2dc";
    case "blue":
      return "#e8f0f5";
    case "vintage":
      return "#e3cd9c";
    default:
      return undefined;
  }
}

/** Shades of one metal, from specular highlight to the dark edge. */
export interface MetalTone {
  highlight: string;
  light: string;
  mid: string;
  shade: string;
  edge: string;
}

const METALS: Record<WatchCase["material"], MetalTone> = {
  "316L steel": { highlight: "#fbfbfb", light: "#e2e4e6", mid: "#b8bcc1", shade: "#868b91", edge: "#5a5f65" },
  titanium: { highlight: "#e0e0dc", light: "#c1c2bf", mid: "#9b9d9c", shade: "#767877", edge: "#535655" },
  bronze: { highlight: "#f1d6a1", light: "#d4ab6e", mid: "#ad8246", shade: "#825d2d", edge: "#5a401f" },
};

const PVD_BLACK: MetalTone = { highlight: "#6d6f73", light: "#46484c", mid: "#2c2e31", shade: "#1b1c1f", edge: "#0b0c0d" };

export function caseMetal(material: WatchCase["material"], finish: WatchCase["finish"]): MetalTone {
  return finish === "PVD black" ? PVD_BLACK : METALS[material] ?? METALS["316L steel"];
}

/** Metal tone built around an arbitrary base colour (bracelets, applied indices). */
export function metalFrom(base: string): MetalTone {
  return {
    highlight: lighten(base, 0.7),
    light: lighten(base, 0.35),
    mid: base,
    shade: darken(base, 0.28),
    edge: darken(base, 0.5),
  };
}

export const SILVER = "#cfd3d7";
export const GOLD = "#c9a45c";
