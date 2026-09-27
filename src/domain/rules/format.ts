import type {
  BezelInsert,
  CrownPosition,
  DateWindow,
  LumeColor,
  PartCategory,
  WatchStyle,
} from "../types";

/** Noun used after a part's name: "the 'Mercedes Silver' hands". */
export const PART_NOUN: Record<PartCategory, string> = {
  movement: "movement",
  case: "case",
  dial: "dial",
  hands: "hands",
  crystal: "crystal",
  bezelInsert: "bezel insert",
  strap: "strap",
};

/** Indefinite phrase for a part category: "a hand set". */
export const A_PART: Record<PartCategory, string> = {
  movement: "a movement",
  case: "a case",
  dial: "a dial",
  hands: "a hand set",
  crystal: "a crystal",
  bezelInsert: "a bezel insert",
  strap: "a strap",
};

export function quote(text: string): string {
  return `'${text}'`;
}

/** "a", "a and b", "a, b and c". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Customer wording for a crown position; the 3.8 position reads as "about 4 o'clock". */
export function crownLabel(position: CrownPosition): string {
  return position === 3.8 ? "about 4 o'clock" : `${position} o'clock`;
}

export function dateWindowLabel(window: DateWindow): string {
  switch (window) {
    case "none":
      return "no date window";
    case "date-3":
      return "a date window at 3";
    case "day-date-3":
      return "a day-date window at 3";
  }
}

/** Adjective for a dial or case style: "a dress dial in a dive-style case". */
export function styleLabel(style: WatchStyle): string {
  switch (style) {
    case "diver":
      return "dive-style";
    case "gmt":
      return "GMT";
    default:
      return style;
  }
}

export function scaleLabel(scale: BezelInsert["scale"]): string {
  switch (scale) {
    case "dive-60":
      return "60-minute dive";
    case "gmt-24":
      return "24-hour";
    case "countdown-60":
      return "60-minute countdown";
    case "plain":
      return "plain";
  }
}

export function lumeLabel(lume: Exclude<LumeColor, "none">): string {
  return lume === "vintage" ? "vintage (cream-tinted)" : lume;
}
