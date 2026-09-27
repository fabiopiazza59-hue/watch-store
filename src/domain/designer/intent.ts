// Reads a customer's message into structured design preferences for the offline designer.
// Deliberately simple keyword matching: predictable, explainable and good enough to seed a design
// that the customer then refines in the configurator.
import { normalizePersonalizationText, reviewText } from "../rules";
import { clampDesignName } from "../schemas";
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
  /** Styles the customer said they don't want ("I don't want a diver"). */
  rejectedStyles: WatchStyle[];
  colors: Record<ColorTarget, ColorName[]>;
  /** Dial colours meant for the print rather than the dial itself: "red accents", "white numerals". */
  dialPrint: ColorName[];
  /** The customer's own word for each colour, for replies: "pink" rather than "salmon". */
  colorWords: Partial<Record<ColorName, string>>;
  size?: SizePreference;
  slim: boolean;
  vintage: boolean;
  date?: DateWindow;
  gmt: boolean;
  /** A movement asked for by calibre, e.g. "NH38A". */
  caliber?: string;
  lume: boolean;
  indices?: Dial["indices"];
  sunburst: boolean;
  strapType?: Strap["type"];
  material?: Exclude<WatchCase["material"], "316L steel">;
  blackCase: boolean;
  displayCaseback: boolean;
  /** Water resistance asked for, in metres. */
  waterResistanceM?: number;
  /** "Remove the bezel": a watch without a rotating bezel. */
  noBezel: boolean;
  ceramic: boolean;
  mineral: boolean;
  countdown: boolean;
  budgetEur?: number;
  /** "Make it cheaper", "something affordable": as little as possible, with no figure given. */
  lean: boolean;
  designName?: string;
  /** The quoted name was longer than a design name may be, so `designName` is shortened. */
  nameShortened: boolean;
  /** A quoted name that can't be used, with the trademarks or Swiss indications it contains. */
  rejectedName?: { text: string; marks: string[] };
  dialText?: string;
  casebackEngraving?: string;
  /** Dial text or an engraving asked for without the words in quotes ("add an engraving"). */
  unquotedText?: "dial" | "caseback";
  clearDialText: boolean;
  clearEngraving: boolean;
  /** Other watch companies' trademarks the customer mentioned (outside quoted text). */
  brands: string[];
  /** The customer mentioned a protected Swiss indication ("Swiss Made"). */
  swiss: boolean;
  unsupported: UnsupportedFeature[];
  /** The message looks like it is in another language than English. */
  foreign: boolean;
  /** Anything at all was understood; false for greetings, questions and messages in other languages. */
  recognised: boolean;
}

const STYLE_WORDS: Record<WatchStyle, string[]> = {
  diver: [
    "dive",
    "diver",
    "divers",
    "diving",
    "scuba",
    "submariner",
    "seamaster",
    "sub",
    "swim",
    "swimming",
    "snorkeling",
    "ocean",
    "beach",
    "skx",
    // French, Italian, Spanish, German
    "plongee",
    "plongeur",
    "subacqueo",
    "subacquea",
    "buceo",
    "buzo",
    "taucher",
    "taucheruhr",
  ],
  field: ["field", "military", "army", "outdoor", "outdoors", "hiking", "explorer", "rugged", "adventure", "camping", "expedition", "militaire", "militare", "militar"],
  dress: ["dress", "dressy", "formal", "elegant", "wedding", "suit", "tuxedo", "classy", "minimal", "minimalist", "refined", "office", "habillee", "elegante", "vestir"],
  pilot: ["pilot", "pilots", "aviator", "aviation", "flieger", "cockpit", "aviateur", "pilota", "piloto", "fliegeruhr"],
  gmt: ["gmt", "travel", "traveling", "travelling", "traveller", "traveler", "timezone", "timezones", "pepsi", "coke"],
  sport: ["sport", "sporty", "sports", "gym", "athletic", "active", "sportive", "sportiva", "deportivo"],
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
  cadran: "dial",
  quadrante: "dial",
  esfera: "dial",
  zifferblatt: "dial",
  strap: "strap",
  straps: "strap",
  band: "strap",
  leather: "strap",
  rubber: "strap",
  nato: "strap",
  nylon: "strap",
  canvas: "strap",
  bracelet: "strap",
  correa: "strap",
  cinturino: "strap",
  armband: "strap",
  bezel: "bezel",
  insert: "bezel",
  lunette: "bezel",
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

/** Dial words that point at the print: a colour tied to them is the print's colour. */
const PRINT_WORDS = new Set(["numerals", "numbers", "indices", "markers", "print", "details", "accents"]);

/** How many words after a colour we look for the part it describes. */
const COLOR_TARGET_WINDOW = 4;
/** How many words before a colour we look for its part: "make the strap brown". */
const COLOR_TARGET_BACK_WINDOW = 3;

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
  "ceramic",
  "aluminium",
  "aluminum",
  "sapphire",
]);

/** Words that may sit between a part and a colour that follows it: "change the hands to gold". */
const BACKWARD_FILLER_WORDS = new Set(["the", "to", "into", "in", "be", "is", "a", "an", "make", "turn", "change", "it", "its"]);

/** Words that end the search for the part a colour belongs to. */
const COLOR_STOP_WORDS = new Set(["and", "with", "but"]);

/** Words for luminous paint: a colour next to them is the glow, not the dial ("lume that glows blue"). */
const LUME_WORDS = new Set(["lume", "lumed", "luminous", "glow", "glows", "glowing"]);

/** "rose gold" and friends are gold, not a pink colour next to a gold one. */
const GOLD_TINTS = new Set(["rose", "pink", "red", "yellow"]);

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
  // French, Italian, Spanish, German
  ["cuir", "leather"],
  ["pelle", "leather"],
  ["cuero", "leather"],
  ["leder", "leather"],
  ["caoutchouc", "rubber"],
  ["gomma", "rubber"],
  ["caucho", "rubber"],
  ["goma", "rubber"],
  ["kautschuk", "rubber"],
];

/** In French a "bracelet" is any strap: "bracelet en cuir" is a leather strap. */
const FRENCH_STRAP_MATERIALS = new Set(["en", "cuir", "caoutchouc", "tissu", "nylon"]);

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

/** Words that only turn up in the other languages customers most often write in. */
const FOREIGN_WORDS = new Set([
  "une",
  "montre",
  "voudrais",
  "avec",
  "orologio",
  "vorrei",
  "reloj",
  "quiero",
  "uhr",
  "eine",
  "mochte",
  "mit",
]);

// Quoted text: “double” or 'single' quotes that open after a space and close before a space or
// punctuation, so apostrophes in "grandpa's" or "I'm" are not mistaken for quotes.
const QUOTE_PATTERN = /(^|[\s(:,])(?:["“]([^"”\n]{1,120})["”]|['‘]([^'‘’\n]{1,120})['’])(?=$|[\s.,!?;:)])/gu;
const ENGRAVING_CUE = /engrav|case ?back|\bback\b|\brear\b/g;
const DIAL_CUE = /\bdial\b|\bprint|\bface\b|\bwrit/g;
const NAME_CUE = /\b(?:call|name|named|called)\b/g;
/** Unquoted text after an explicit label and colon: "engraving: For Sam", "dial text: Est. 2026". */
const LABELLED_TEXT = /\b(engraving|engrave|case ?back|dial text)\s*:\s*([^\n]+?)[\s.!]*$/i;
const UNQUOTED_ENGRAVING = /\bengrav(?:e|ed|ing)\b/;
const UNQUOTED_DIAL_TEXT = /\b(?:dial text|text on the dial|print(?:ed)? (?:on|onto) the dial|write on the dial)\b/;

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

/**
 * Takes out the text meant to be printed, engraved or used as a name (quoted, or after a label
 * and a colon), so its words aren't read as design wishes. `rest` is what remains.
 */
function extractTexts(message: string): { quotes: QuotedText[]; rest: string } {
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
  rest += message.slice(cursor);

  const labelled = rest.match(LABELLED_TEXT);
  if (labelled?.[2].trim()) {
    const target = /engrav|back/i.test(labelled[1]) ? "caseback" : "dial";
    if (!quotes.some((quote) => quote.target === target)) {
      quotes.push({ text: labelled[2].trim(), target });
      rest = rest.slice(0, labelled.index) + labelled[1];
    }
  }
  return { quotes, rest };
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

/**
 * Words the customer ruled out: "not black", "I don't want a diver", "instead of the olive one".
 * A bare "no" doesn't count: "no date" and "no, keep the case" are wishes, not refusals.
 */
const NEGATION = /\b(?:not|dont want|do not want|dont like|do not like|instead of|rather than|anything but|no longer)\s+(?:an?\s+|the\s+|any\s+)?([a-z]+)/g;

function negatedWords(text: string): Set<string> {
  const plain = text.toLowerCase().replace(/['’]/g, "");
  return new Set([...plain.matchAll(NEGATION)].map((match) => match[1]));
}

function detectStyle(joined: string, negated: Set<string>): { style?: WatchStyle; rejected: WatchStyle[] } {
  let best: { style: WatchStyle; index: number } | undefined;
  const rejected: WatchStyle[] = [];
  for (const [style, words] of Object.entries(STYLE_WORDS) as [WatchStyle, string[]][]) {
    if (words.some((word) => negated.has(word))) {
      rejected.push(style);
      continue;
    }
    const index = firstPhraseIndex(joined, words);
    if (index >= 0 && (!best || index < best.index)) best = { style, index };
  }
  return { style: best?.style, rejected };
}

function firstPhraseIndex(joined: string, phrases: string[]): number {
  const indices = phrases.map((phrase) => ` ${joined} `.indexOf(` ${phrase} `)).filter((index) => index >= 0);
  return indices.length > 0 ? Math.min(...indices) : -1;
}

const STYLE_WORD_SET = new Set(Object.values(STYLE_WORDS).flat());

interface ColorMention {
  color: ColorName;
  word: string;
  target: ColorTarget | "watch";
  /** The part word that named the target, e.g. "case" in "black case" (vs "black titanium"). */
  targetWord?: string;
}

/**
 * The part named just before a colour: "make the strap brown", "change the hands to gold". Only
 * filler words may sit between them, unless `loose` (for "a blue one", which can refer further back).
 */
function partBefore(
  tokens: string[],
  i: number,
  window: number,
  loose = false,
): { target: ColorTarget | "watch"; word: string } | undefined {
  for (let j = i - 1; j >= 0 && j >= i - window; j--) {
    const word = tokens[j];
    const target = COLOR_TARGET_WORDS[word];
    if (target && word !== "one") return { target, word };
    if (COLOR_STOP_WORDS.has(word) || colorForWord(word)) return undefined;
    if (!loose && !BACKWARD_FILLER_WORDS.has(word)) return undefined;
  }
  return undefined;
}

/**
 * The part a colour describes: the part word after it ("blue dial"), else the one just before it
 * ("make the strap brown"), else the watch as a whole. Null when the colour is the lume's glow.
 */
function colorMentionAt(tokens: string[], i: number, color: ColorName): ColorMention | null {
  const word = tokens[i];
  if (LUME_WORDS.has(tokens[i - 1]) || LUME_WORDS.has(tokens[i - 2])) return null;
  for (let j = i + 1; j < tokens.length && j <= i + COLOR_TARGET_WINDOW; j++) {
    if (LUME_WORDS.has(tokens[j])) return null;
    const target = COLOR_TARGET_WORDS[tokens[j]];
    if (target) {
      // "a blue one" points back at a part named earlier: "swap the strap for a blue one".
      const earlier = tokens[j] === "one" ? partBefore(tokens, i, 6, true) : undefined;
      return earlier
        ? { color, word, target: earlier.target, targetWord: earlier.word }
        : { color, word, target, targetWord: tokens[j] };
    }
    const descriptive = colorForWord(tokens[j]) || COLOR_FILLER_WORDS.has(tokens[j]) || STYLE_WORD_SET.has(tokens[j]);
    if (!descriptive) break;
  }
  const before = partBefore(tokens, i, COLOR_TARGET_BACK_WINDOW);
  return before ? { color, word, target: before.target, targetWord: before.word } : { color, word, target: "watch" };
}

interface ColorPreferences {
  colors: Record<ColorTarget, ColorName[]>;
  dialPrint: ColorName[];
  colorWords: Partial<Record<ColorName, string>>;
  /** Gold asked for on the case or the watch as a whole, which no case can provide. */
  goldCase: boolean;
  /** "black case": asked for a black case finish. */
  blackCase: boolean;
}

function detectColors(tokens: string[], negated: Set<string>): ColorPreferences {
  const colors: Record<ColorTarget, ColorName[]> = { dial: [], strap: [], bezel: [], hands: [], case: [] };
  const colorWords: Partial<Record<ColorName, string>> = {};
  const add = (target: ColorTarget, color: ColorName) => {
    if (!colors[target].includes(color)) colors[target].push(color);
  };
  const mentions = tokens.flatMap((token, i) => {
    const color = colorForWord(token);
    if (!color || negated.has(token)) return [];
    if (GOLD_TINTS.has(token) && tokens[i + 1] === "gold") return [];
    const mention = colorMentionAt(tokens, i, color);
    return mention ? [mention] : [];
  });
  const dialPrint: ColorName[] = [];
  let goldCase = false;
  for (const { color, word, target, targetWord } of mentions) {
    colorWords[color] ??= word;
    if (color === "gold" && (target === "watch" || target === "case")) goldCase = true;
    else add(target === "watch" ? "dial" : target, color);
    if (target === "dial" && targetWord && PRINT_WORDS.has(targetWord) && !dialPrint.includes(color)) dialPrint.push(color);
  }
  // No case comes in gold: the closest the library gets is gold print, after any dial colour named.
  if (goldCase) add("dial", "gold");
  if (colors.dial.length === 0) {
    colors.case.filter((color) => color !== "silver").forEach((color) => add("dial", color));
  }
  for (const [nickname, bezel] of Object.entries(BEZEL_NICKNAMES)) {
    if (colors.bezel.length === 0 && tokens.includes(nickname)) colors.bezel.push(...bezel);
  }
  const blackCase = mentions.some(({ color, targetWord }) => color === "black" && targetWord === "case");
  return { colors, dialPrint, colorWords, goldCase, blackCase };
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

const DATE_REMOVALS = [
  "remove the date",
  "remove the date window",
  "drop the date",
  "lose the date",
  "delete the date",
  "get rid of the date",
  "take off the date",
  "take the date off",
  "no more date",
  "dont want a date",
  "dont want the date",
  "do not want a date",
];

function detectDate(joined: string): DateWindow | undefined {
  if (hasPhrase(joined, DATE_REMOVALS)) return "none";
  if (hasPhrase(joined, ["no date", "without date", "without a date", "dateless", "no date window", "without the date"])) {
    return "none";
  }
  if (hasPhrase(joined, ["day date", "day and date", "weekday", "day of the week"])) return "day-date-3";
  if (hasPhrase(joined, ["date", "date window"])) return "date-3";
  return undefined;
}

/**
 * A movement asked for by calibre. "swap the NH35 for an NH38" and "an NH38 instead of the NH35"
 * both mean the NH38: a calibre after swap, replace, from, not or instead of is the one to go.
 */
function detectCaliber(lower: string): string | undefined {
  const wanted = [...lower.matchAll(/\bnh[\s-]?3([4568])a?\b/g)].filter(
    (match) => !/(?:swap|replace|change|from|not|instead of|rather than)(?:\s+(?:the|an?|my|your))?\s*$/.test(lower.slice(0, match.index)),
  );
  const last = wanted.at(-1);
  return last ? `NH3${last[1]}A` : undefined;
}

const DATE_BY_CALIBER: Record<string, DateWindow> = { NH34A: "date-3", NH35A: "date-3", NH36A: "day-date-3", NH38A: "none" };

/** "300m", "200 metres", "20 bar", "10 atm". */
function detectWaterResistance(lower: string): number | undefined {
  const metres = lower.match(/\b(\d{2,4})\s?(?:m|meters?|metres?)\b/);
  if (metres && Number(metres[1]) >= 30 && Number(metres[1]) <= 2000) return Number(metres[1]);
  const pressure = lower.match(/\b(\d{1,3})\s?(?:atm|bar)\b/);
  if (pressure && Number(pressure[1]) >= 3) return Number(pressure[1]) * 10;
  return undefined;
}

function detectStrapType(tokens: string[]): Strap["type"] | undefined {
  for (const [i, token] of tokens.entries()) {
    const hit = STRAP_WORDS.find(([word]) => word === token);
    if (!hit) continue;
    if (token === "bracelet" && tokens.slice(i + 1, i + 3).some((next) => FRENCH_STRAP_MATERIALS.has(next))) continue;
    return hit[1];
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

/** A quoted design name, shortened to fit, unless it uses someone else's name. */
function readName(text: string | undefined): Pick<DesignIntent, "designName" | "nameShortened" | "rejectedName"> {
  if (text === undefined) return { nameShortened: false };
  const review = reviewText(text);
  const marks = [...review.trademarks, ...review.protectedIndications];
  if (marks.length > 0) return { nameShortened: false, rejectedName: { text, marks } };
  const designName = clampDesignName(text);
  return { designName, nameShortened: designName !== text };
}

/** True when the intent holds anything to act on or answer. */
function recognisedAnything(intent: Omit<DesignIntent, "recognised">): boolean {
  const flags = [
    intent.slim,
    intent.vintage,
    intent.gmt,
    intent.lume,
    intent.sunburst,
    intent.blackCase,
    intent.displayCaseback,
    intent.noBezel,
    intent.ceramic,
    intent.mineral,
    intent.countdown,
    intent.lean,
    intent.clearDialText,
    intent.clearEngraving,
    intent.swiss,
  ];
  const values = [
    intent.style,
    intent.size,
    intent.date,
    intent.caliber,
    intent.indices,
    intent.strapType,
    intent.material,
    intent.waterResistanceM,
    intent.budgetEur,
    intent.designName,
    intent.rejectedName,
    intent.dialText,
    intent.casebackEngraving,
    intent.unquotedText,
  ];
  const lists = [intent.rejectedStyles, intent.brands, intent.unsupported, ...Object.values(intent.colors)];
  return flags.some(Boolean) || values.some((value) => value !== undefined) || lists.some((list) => list.length > 0);
}

export function parseIntent(message: string): DesignIntent {
  const { quotes, rest } = extractTexts(message);
  const lower = rest.toLowerCase();
  const tokens = tokenize(rest);
  const joined = tokens.join(" ");
  const negated = negatedWords(rest);
  const { style, rejected: rejectedStyles } = detectStyle(joined, negated);
  const { colors, dialPrint, colorWords, goldCase, blackCase } = detectColors(tokens, negated);
  const material = hasPhrase(joined, ["titanium"]) ? "titanium" : hasPhrase(joined, ["bronze"]) ? "bronze" : undefined;
  const review = reviewText(withoutIdioms(rest));
  const quoted = (target: QuoteTarget) => quotes.find((quote) => quote.target === target)?.text;
  const caliber = detectCaliber(lower);
  // Phones type curly apostrophes and dashes; they are stored and judged as plain ones.
  const plain = (text: string | undefined) => (text === undefined ? undefined : normalizePersonalizationText(text));
  const dialText = plain(quoted("dial"));
  const casebackEngraving = plain(quoted("caseback"));
  const clearDialText = hasPhrase(joined, [
    "remove the text",
    "remove the dial text",
    "delete the text",
    "delete the dial text",
    "drop the text",
    "drop the dial text",
    "remove the printing",
    "no text",
    "without text",
    "no dial text",
  ]);
  const clearEngraving = hasPhrase(joined, [
    "remove the engraving",
    "delete the engraving",
    "drop the engraving",
    "lose the engraving",
    "no engraving",
    "without engraving",
    "without an engraving",
  ]);
  const unquotedText =
    casebackEngraving === undefined && !clearEngraving && UNQUOTED_ENGRAVING.test(lower)
      ? "caseback"
      : dialText === undefined && !clearDialText && UNQUOTED_DIAL_TEXT.test(lower)
        ? "dial"
        : undefined;

  const unsupported = UNSUPPORTED_PHRASES.filter(([, phrases]) => hasPhrase(joined, phrases)).map(([feature]) => feature);
  if (goldCase && !unsupported.includes("gold-case")) unsupported.push("gold-case");

  const intent: Omit<DesignIntent, "recognised"> = {
    style,
    rejectedStyles,
    colors,
    dialPrint,
    colorWords,
    size: detectSize(lower, joined),
    slim: hasPhrase(joined, ["slim", "thin", "flat", "low profile"]),
    vintage: hasPhrase(joined, ["vintage", "retro", "classic", "heritage", "patina", "aged", "old school", "1950s", "1960s"]),
    date: detectDate(joined) ?? (caliber ? DATE_BY_CALIBER[caliber] : undefined),
    gmt: style === "gmt" || hasPhrase(joined, GMT_PHRASES) || caliber === "NH34A",
    caliber,
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
    waterResistanceM: detectWaterResistance(lower),
    noBezel: hasPhrase(joined, ["remove the bezel", "no bezel", "without a bezel", "without bezel", "without the bezel", "bezelless"]),
    ceramic: hasPhrase(joined, ["ceramic"]),
    mineral: hasPhrase(joined, ["mineral"]),
    countdown: hasPhrase(joined, ["countdown", "count down", "timer"]),
    budgetEur: detectBudget(lower),
    lean: hasPhrase(joined, [
      "cheap",
      "cheaper",
      "cheapest",
      "affordable",
      "more affordable",
      "budget friendly",
      "inexpensive",
      "less expensive",
      "lower price",
      "low cost",
    ]),
    ...readName(quoted("name")),
    dialText,
    casebackEngraving,
    unquotedText,
    clearDialText,
    clearEngraving,
    brands: review.trademarks,
    swiss: review.protectedIndications.length > 0,
    unsupported,
    foreign: tokens.some((token) => FOREIGN_WORDS.has(token)),
  };
  return { ...intent, recognised: recognisedAnything(intent) };
}
