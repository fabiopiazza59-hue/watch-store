// Reads a customer's message into structured design preferences for the offline designer.
// Deliberately simple keyword matching: predictable, explainable and good enough to seed a design
// that the customer then refines in the configurator.
import { reviewText } from "../rules";
import type { DateWindow, Dial, Strap, WatchCase, WatchStyle } from "../types";
import { colorForWord, type ColorName } from "./colors";

/** Parts of the watch a colour can be asked for. */
export type ColorTarget = "dial" | "strap" | "bezel" | "hands" | "case";

/** Requests the parts library cannot satisfy; the designer says so and offers the closest thing. */
export type UnsupportedFeature =
  | "quartz"
  | "tourbillon"
  | "chronograph"
  | "moonphase"
  | "gold-case"
  | "smartwatch"
  | "gemstones"
  | "skeleton";

export type SizePreference = { kind: "target"; mm: number } | { kind: "small" } | { kind: "large" };

export interface DesignIntent {
  style?: WatchStyle;
  colors: Record<ColorTarget, ColorName[]>;
  size?: SizePreference;
  slim: boolean;
  vintage: boolean;
  date?: DateWindow;
  gmt: boolean;
  lume: boolean;
  indices?: Dial["indices"];
  sunburst: boolean;
  strapType?: Strap["type"];
  material?: Exclude<WatchCase["material"], "316L steel">;
  blackCase: boolean;
  displayCaseback: boolean;
  ceramic: boolean;
  mineral: boolean;
  countdown: boolean;
  budgetEur?: number;
  designName?: string;
  dialText?: string;
  casebackEngraving?: string;
  clearDialText: boolean;
  clearEngraving: boolean;
  /** Other watch companies' trademarks the customer mentioned (outside quoted text). */
  brands: string[];
  /** The customer mentioned a protected Swiss indication ("Swiss Made"). */
  swiss: boolean;
  unsupported: UnsupportedFeature[];
}

const STYLE_WORDS: Record<WatchStyle, string[]> = {
  diver: ["dive", "diver", "divers", "diving", "scuba", "submariner", "seamaster", "sub", "swim", "swimming", "snorkeling", "ocean", "beach", "skx"],
  field: ["field", "military", "army", "outdoor", "outdoors", "hiking", "explorer", "rugged", "adventure", "camping", "expedition"],
  dress: ["dress", "dressy", "formal", "elegant", "wedding", "suit", "tuxedo", "classy", "minimal", "minimalist", "refined", "office"],
  pilot: ["pilot", "pilots", "aviator", "aviation", "flieger", "cockpit"],
  gmt: ["gmt", "travel", "traveling", "travelling", "traveller", "traveler", "timezone", "timezones", "pepsi", "coke"],
  sport: ["sport", "sporty", "sports", "gym", "athletic", "active"],
};

const GMT_PHRASES = ["gmt", "time zone", "time zones", "timezone", "timezones", "dual time", "second time zone", "world time"];

/** Words that tie a colour to a part: "blue dial", "brown leather strap", "black titanium". */
const COLOR_TARGET_WORDS: Record<string, ColorTarget | "watch"> = {
  dial: "dial",
  dials: "dial",
  face: "dial",
  numerals: "dial",
  numbers: "dial",
  indices: "dial",
  markers: "dial",
  print: "dial",
  details: "dial",
  accents: "dial",
  strap: "strap",
  straps: "strap",
  band: "strap",
  leather: "strap",
  rubber: "strap",
  nato: "strap",
  nylon: "strap",
  canvas: "strap",
  bracelet: "strap",
  bezel: "bezel",
  insert: "bezel",
  hands: "hands",
  hand: "hands",
  case: "case",
  titanium: "case",
  bronze: "case",
  watch: "watch",
  watches: "watch",
  one: "watch",
  timepiece: "watch",
};

/** How many words after a colour we look for the part it describes. */
const COLOR_TARGET_WINDOW = 4;

/** Words that may sit between a colour and its part without breaking the link. */
const COLOR_FILLER_WORDS = new Set([
  "and",
  "a",
  "an",
  "dark",
  "light",
  "deep",
  "bright",
  "matte",
  "glossy",
  "sunburst",
  "vintage",
  "stainless",
  "steel",
  "metal",
]);

/** Nicknamed two-tone bezels customers ask for by name. */
const BEZEL_NICKNAMES: Record<string, ColorName[]> = { pepsi: ["blue", "red"], coke: ["black", "red"] };

const STRAP_WORDS: [string, Strap["type"]][] = [
  ["leather", "leather"],
  ["rubber", "rubber"],
  ["silicone", "rubber"],
  ["fkm", "rubber"],
  ["nato", "nato"],
  ["nylon", "nato"],
  ["zulu", "nato"],
  ["canvas", "canvas"],
  ["fabric", "canvas"],
  ["bracelet", "bracelet"],
  ["jubilee", "bracelet"],
  ["links", "bracelet"],
];

const UNSUPPORTED_PHRASES: [UnsupportedFeature, string[]][] = [
  ["quartz", ["quartz", "battery", "batteries"]],
  ["tourbillon", ["tourbillon"]],
  ["chronograph", ["chronograph", "chrono", "stopwatch", "speedmaster", "daytona"]],
  ["moonphase", ["moonphase", "moon phase", "moon phases"]],
  ["gold-case", ["solid gold", "gold case", "gold plated", "rose gold", "yellow gold", "18k", "14k"]],
  ["smartwatch", ["smartwatch", "smart watch", "heart rate", "bluetooth", "notifications", "gps"]],
  ["gemstones", ["diamond", "diamonds", "gem", "gems", "gemstone", "gemstones"]],
  ["skeleton", ["skeleton", "skeletonized", "skeletonised", "open heart"]],
];

// Quoted text: “double” or 'single' quotes that open after a space and close before a space or
// punctuation, so apostrophes in "grandpa's" or "I'm" are not mistaken for quotes.
const QUOTE_PATTERN = /(^|[\s(:,])(?:["“]([^"”\n]{1,120})["”]|['‘]([^'‘’\n]{1,120})['’])(?=$|[\s.,!?;:)])/gu;
const ENGRAVING_CUE = /engrav|case ?back|\bback\b|\brear\b/g;
const DIAL_CUE = /\bdial\b|\bprint|\bface\b|\bwrit/g;
const NAME_CUE = /\b(?:call|name|named|called)\b/g;

type QuoteTarget = "dial" | "caseback" | "name";

interface QuotedText {
  text: string;
  target: QuoteTarget;
}

function lastIndexOf(pattern: RegExp, text: string): number {
  let last = -1;
  for (const match of text.matchAll(pattern)) last = match.index;
  return last;
}

/** Where a quoted text should go, judged by the nearest cue before it (or just after it). */
function quoteTarget(before: string, after: string): QuoteTarget {
  const cues: [QuoteTarget, number][] = [
    ["caseback", lastIndexOf(ENGRAVING_CUE, before)],
    ["dial", lastIndexOf(DIAL_CUE, before)],
    ["name", lastIndexOf(NAME_CUE, before)],
  ];
  const [nearest, index] = cues.reduce((best, cue) => (cue[1] > best[1] ? cue : best));
  if (index >= 0) return nearest;
  return /engrav|\bback\b|case ?back/.test(after) ? "caseback" : "dial";
}

function extractQuotes(message: string): { quotes: QuotedText[]; rest: string } {
  const quotes: QuotedText[] = [];
  let rest = "";
  let cursor = 0;
  const matches = [...message.matchAll(QUOTE_PATTERN)];
  matches.forEach((match, i) => {
    const start = match.index + match[1].length;
    const end = match.index + match[0].length;
    const nextStart = matches[i + 1]?.index ?? message.length;
    const text = (match[2] ?? match[3]).trim();
    const before = message.slice(cursor, start).toLowerCase();
    const after = message.slice(end, Math.min(nextStart, end + 30)).toLowerCase();
    if (text) quotes.push({ text, target: quoteTarget(before, after) });
    rest += `${message.slice(cursor, start)} `;
    cursor = end;
  });
  return { quotes, rest: rest + message.slice(cursor) };
}

function tokenize(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** True when any phrase occurs as whole words in the space-joined token string. */
function hasPhrase(joined: string, phrases: string[]): boolean {
  return phrases.some((phrase) => ` ${joined} `.includes(` ${phrase} `));
}

function firstPhraseIndex(joined: string, phrases: string[]): number {
  const indices = phrases.map((phrase) => ` ${joined} `.indexOf(` ${phrase} `)).filter((index) => index >= 0);
  return indices.length > 0 ? Math.min(...indices) : -1;
}

function detectStyle(joined: string): WatchStyle | undefined {
  let best: { style: WatchStyle; index: number } | undefined;
  for (const [style, words] of Object.entries(STYLE_WORDS) as [WatchStyle, string[]][]) {
    const index = firstPhraseIndex(joined, words);
    if (index >= 0 && (!best || index < best.index)) best = { style, index };
  }
  return best?.style;
}

const STYLE_WORD_SET = new Set(Object.values(STYLE_WORDS).flat());

interface ColorMention {
  color: ColorName;
  target: ColorTarget | "watch";
  /** The part word that followed, e.g. "case" in "black case" (vs "black titanium"). */
  targetWord?: string;
}

function colorMentionAt(tokens: string[], i: number, color: ColorName): ColorMention {
  for (let j = i + 1; j < tokens.length && j <= i + COLOR_TARGET_WINDOW; j++) {
    const target = COLOR_TARGET_WORDS[tokens[j]];
    if (target) return { color, target, targetWord: tokens[j] };
    const descriptive = colorForWord(tokens[j]) || COLOR_FILLER_WORDS.has(tokens[j]) || STYLE_WORD_SET.has(tokens[j]);
    if (!descriptive) break;
  }
  // "a strap in brown", "dial in navy"
  const backTarget = tokens[i - 1] === "in" ? COLOR_TARGET_WORDS[tokens[i - 2]] : undefined;
  return backTarget ? { color, target: backTarget, targetWord: tokens[i - 2] } : { color, target: "watch" };
}

interface ColorPreferences {
  colors: Record<ColorTarget, ColorName[]>;
  /** Gold asked for on the case or the watch as a whole, which no case can provide. */
  goldCase: boolean;
  /** "black case": asked for a black case finish. */
  blackCase: boolean;
}

function detectColors(tokens: string[]): ColorPreferences {
  const colors: Record<ColorTarget, ColorName[]> = { dial: [], strap: [], bezel: [], hands: [], case: [] };
  const add = (target: ColorTarget, color: ColorName) => {
    if (!colors[target].includes(color)) colors[target].push(color);
  };
  const mentions = tokens.flatMap((token, i) => {
    const color = colorForWord(token);
    return color ? [colorMentionAt(tokens, i, color)] : [];
  });
  let goldCase = false;
  for (const { color, target } of mentions) {
    if (color === "gold" && (target === "watch" || target === "case")) {
      // No case comes in gold: the closest the library gets is gold print on the dial.
      goldCase = true;
      add("dial", color);
    } else {
      add(target === "watch" ? "dial" : target, color);
    }
  }
  if (colors.dial.length === 0) {
    colors.case.filter((color) => color !== "silver").forEach((color) => add("dial", color));
  }
  for (const [nickname, bezel] of Object.entries(BEZEL_NICKNAMES)) {
    if (colors.bezel.length === 0 && tokens.includes(nickname)) colors.bezel.push(...bezel);
  }
  const blackCase = mentions.some(({ color, targetWord }) => color === "black" && targetWord === "case");
  return { colors, goldCase, blackCase };
}

const NOT_A_CASE_SIZE = /^\s*(?:strap|band|lug|lugs|bracelet|nato)/;

function detectSize(lower: string, joined: string): SizePreference | undefined {
  for (const match of lower.matchAll(/(\d{2}(?:[.,]\d)?)\s?mm\b/g)) {
    const mm = parseFloat(match[1].replace(",", "."));
    const following = lower.slice(match.index + match[0].length);
    if (mm >= 30 && mm <= 50 && !NOT_A_CASE_SIZE.test(following)) return { kind: "target", mm };
  }
  if (hasPhrase(joined, ["small", "smaller", "compact", "petite", "little", "tiny", "small wrist", "slim wrist", "thin wrist"])) {
    return { kind: "small" };
  }
  if (hasPhrase(joined, ["big", "bigger", "large", "larger", "oversized", "chunky", "bold", "big wrist"])) {
    return { kind: "large" };
  }
  return undefined;
}

function detectDate(joined: string): DateWindow | undefined {
  if (hasPhrase(joined, ["no date", "without date", "without a date", "dateless", "no date window", "without the date"])) {
    return "none";
  }
  if (hasPhrase(joined, ["day date", "day and date", "weekday", "day of the week"])) return "day-date-3";
  if (hasPhrase(joined, ["date", "date window"])) return "date-3";
  return undefined;
}

function detectStrapType(tokens: string[]): Strap["type"] | undefined {
  for (const token of tokens) {
    const hit = STRAP_WORDS.find(([word]) => word === token);
    if (hit) return hit[1];
  }
  return undefined;
}

function detectIndices(joined: string): Dial["indices"] | undefined {
  if (hasPhrase(joined, ["roman", "romans"])) return "roman";
  if (hasPhrase(joined, ["arabic", "numbers", "numerals", "digits"])) return "arabic";
  if (hasPhrase(joined, ["applied"])) return "applied";
  return undefined;
}

const AMOUNT = "(\\d{2,5})";
const NOT_A_MEASUREMENT = "(?!\\s?(?:mm|m\\b|meters?|metres?|atm|bar|ft|feet|hours?|h\\b|jewels?))";
const BUDGET_PATTERNS = [
  new RegExp(`[€$£]\\s?${AMOUNT}\\b`),
  new RegExp(`\\b${AMOUNT}\\s?(?:€|(?:eur|euros?|dollars?|usd|gbp|pounds?|bucks)\\b)`),
  new RegExp(
    `\\b(?:under|below|less than|max|maximum|budget(?: of| is| around)?|up to|no more than|around|about|at most)\\s+${AMOUNT}\\b${NOT_A_MEASUREMENT}`,
  ),
];

function detectBudget(lower: string): number | undefined {
  for (const pattern of BUDGET_PATTERNS) {
    const match = lower.match(pattern);
    const amount = match ? Number(match[1]) : NaN;
    if (amount >= 50) return amount;
  }
  return undefined;
}

/** "price tag" is not the TAG Heuer brand; strip the idiom before the trademark scan. */
function withoutIdioms(text: string): string {
  return text.replace(/\bprice[\s-]+tags?\b/gi, " ");
}

export function parseIntent(message: string): DesignIntent {
  const { quotes, rest } = extractQuotes(message);
  const lower = rest.toLowerCase();
  const tokens = tokenize(rest);
  const joined = tokens.join(" ");
  const style = detectStyle(joined);
  const { colors, goldCase, blackCase } = detectColors(tokens);
  const material = hasPhrase(joined, ["titanium"]) ? "titanium" : hasPhrase(joined, ["bronze"]) ? "bronze" : undefined;
  const review = reviewText(withoutIdioms(rest));
  const quoted = (target: QuoteTarget) => quotes.find((quote) => quote.target === target)?.text;

  const unsupported = UNSUPPORTED_PHRASES.filter(([, phrases]) => hasPhrase(joined, phrases)).map(([feature]) => feature);
  if (goldCase && !unsupported.includes("gold-case")) unsupported.push("gold-case");

  return {
    style,
    colors,
    size: detectSize(lower, joined),
    slim: hasPhrase(joined, ["slim", "thin", "flat", "low profile"]),
    vintage: hasPhrase(joined, ["vintage", "retro", "classic", "heritage", "patina", "aged", "old school", "1950s", "1960s"]),
    date: detectDate(joined),
    gmt: style === "gmt" || hasPhrase(joined, GMT_PHRASES),
    lume: hasPhrase(joined, ["lume", "lumed", "luminous", "glow", "glows", "night"]),
    indices: detectIndices(joined),
    sunburst: hasPhrase(joined, ["sunburst", "sunray"]),
    strapType: detectStrapType(tokens),
    material,
    blackCase: blackCase || hasPhrase(joined, ["pvd", "dlc", "blacked out", "stealth", "all black"]),
    displayCaseback: hasPhrase(joined, [
      "exhibition",
      "display back",
      "display caseback",
      "display case back",
      "see the movement",
      "see through",
      "show the movement",
      "shows the movement",
    ]),
    ceramic: hasPhrase(joined, ["ceramic"]),
    mineral: hasPhrase(joined, ["mineral"]),
    countdown: hasPhrase(joined, ["countdown", "count down", "timer"]),
    budgetEur: detectBudget(lower),
    designName: quoted("name"),
    dialText: quoted("dial"),
    casebackEngraving: quoted("caseback"),
    clearDialText: hasPhrase(joined, ["remove the text", "no text", "without text", "remove the dial text", "no dial text"]),
    clearEngraving: hasPhrase(joined, ["remove the engraving", "no engraving", "without engraving", "without an engraving"]),
    brands: review.trademarks,
    swiss: review.protectedIndications.length > 0,
    unsupported,
  };
}
