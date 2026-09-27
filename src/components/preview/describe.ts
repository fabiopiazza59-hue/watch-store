import type { HandStyle, ResolvedSpec, WatchCase, WatchStyle } from "@/domain/types";
import { colorName, safeHex } from "./color";
import { mm, positive } from "./geometry";

const STYLE_NOUN: Record<WatchStyle, string> = {
  diver: "diver",
  field: "field watch",
  dress: "dress watch",
  pilot: "pilot's watch",
  gmt: "GMT",
  sport: "sport watch",
};

const HAND_NAME: Record<HandStyle, string> = {
  sword: "sword",
  mercedes: "Mercedes",
  dauphine: "dauphine",
  baton: "baton",
  snowflake: "snowflake",
  syringe: "syringe",
  cathedral: "cathedral",
  arrow: "arrow",
};

function caseMaterial(watchCase: WatchCase): string {
  if (watchCase.finish === "PVD black") return "black PVD";
  return watchCase.material === "316L steel" ? "steel" : watchCase.material;
}

/**
 * One-line summary for screen readers, e.g.
 * "42 mm steel diver, black dial, Mercedes hands, black rubber strap".
 */
export function describeWatch(parts: ResolvedSpec, dialText = ""): string {
  const { case: watchCase, dial, hands, strap } = parts;
  const segments = [
    watchCase
      ? `${mm(positive(watchCase.diameterMm, 40))} mm ${caseMaterial(watchCase)} ${STYLE_NOUN[watchCase.style] ?? "watch"}`
      : "case not chosen yet",
    dial
      ? `${colorName(safeHex(dial.colorHex, "#808080"))}${dial.texture === "sunburst" ? " sunburst" : ""} dial`
      : "dial not chosen yet",
    hands ? `${HAND_NAME[hands.style] ?? "plain"} hands` : "hands not chosen yet",
    strap
      ? `${colorName(safeHex(strap.colorHex, "#808080"))} ${strap.type === "nato" ? "NATO" : strap.type}${strap.type === "bracelet" ? "" : " strap"}`
      : "strap not chosen yet",
  ];
  const text = dialText.trim();
  if (text) segments.push(`dial text "${text}"`);
  return segments.join(", ");
}
