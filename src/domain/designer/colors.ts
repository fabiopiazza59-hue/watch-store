// Colour vocabulary for the offline designer: the words customers use, mapped to reference swatches
// that part colours (CSS hex) are compared against.

export type ColorName =
  | "black"
  | "white"
  | "cream"
  | "blue"
  | "teal"
  | "green"
  | "grey"
  | "red"
  | "orange"
  | "salmon"
  | "silver"
  | "brown"
  | "gold";

/** Words customers use for each colour. Keys double as the canonical names used in replies. */
export const COLOR_WORDS: Record<ColorName, string[]> = {
  black: ["black", "noir", "onyx", "blacked"],
  white: ["white", "snow", "polar"],
  cream: ["cream", "ivory", "beige", "vanilla", "eggshell", "sand", "champagne"],
  blue: ["blue", "navy", "azure", "cobalt"],
  teal: ["teal", "turquoise", "petrol"],
  green: ["green", "olive", "forest", "emerald", "sage"],
  grey: ["grey", "gray", "slate", "graphite", "charcoal", "gunmetal", "anthracite"],
  red: ["red", "burgundy", "maroon", "wine", "crimson", "bordeaux", "oxblood"],
  orange: ["orange", "tangerine", "amber"],
  salmon: ["salmon", "pink", "peach", "rose"],
  silver: ["silver", "silvery"],
  brown: ["brown", "tan", "chocolate", "cognac", "coffee", "tobacco", "camel"],
  gold: ["gold", "golden", "gilt"],
};

const REFERENCE_SWATCHES: Record<ColorName, string[]> = {
  black: ["#121212"],
  white: ["#f4f4f0"],
  cream: ["#efe6d2", "#d9c9a3"],
  blue: ["#1f3a5f", "#1f2c44", "#2a5599"],
  teal: ["#1f5f63"],
  green: ["#4a5234", "#2e5e3a", "#3f6b3a"],
  grey: ["#3c4146", "#5b6068", "#8a8f94"],
  red: ["#a8262c", "#5e1f2a"],
  orange: ["#c2571f", "#e0662a"],
  salmon: ["#e8a48a"],
  silver: ["#d6d8d9", "#c9ccd0"],
  brown: ["#6b4226", "#9a6a3f"],
  gold: ["#c9a45c"],
};

/** Colours further apart than this (weighted RGB distance) share nothing. */
const MAX_DISTANCE = 130;

const WORD_TO_COLOR = new Map<string, ColorName>(
  (Object.entries(COLOR_WORDS) as [ColorName, string[]][]).flatMap(([color, words]) =>
    words.map((word) => [word, color] as const),
  ),
);

export function colorForWord(word: string): ColorName | undefined {
  return WORD_TO_COLOR.get(word);
}

function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** "Redmean" weighted RGB distance: cheap and close enough to perceived difference for swatches. */
function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const meanRed = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + meanRed / 256) * dr * dr + 4 * dg * dg + (2 + (255 - meanRed) / 256) * db * db);
}

/** 1 for identical colours, falling to 0 as they drift apart. */
export function colorSimilarity(a: string, b: string): number {
  return Math.max(0, 1 - distance(a, b) / MAX_DISTANCE);
}

/** How well a part colour reads as the named colour, 0..1. */
export function colorMatch(hex: string, color: ColorName): number {
  return Math.max(...REFERENCE_SWATCHES[color].map((swatch) => colorSimilarity(hex, swatch)));
}

/** Perceived lightness, 0 (black) to 1 (white). */
export function lightness(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
