// Reads what a customer asks to add to the order beyond the watch (a spare strap and add-ons from
// the extras catalogue), or to take out. Keyword matching over the message's tokens, like the rest
// of the offline designer: predictable and explainable.
import type { Strap } from "../types";
import { colorForWord, type ColorName } from "./colors";

/** The add-ons the designer understands by name (ids from catalog/extras.ts). */
export const ADD_ON_IDS = {
  box: "extra-presentation-box",
  pouch: "extra-travel-pouch",
  tool: "extra-spring-bar-tool",
  giftWrap: "extra-gift-wrap",
  regulation: "extra-fine-regulation",
  certificate: "extra-timing-certificate",
} as const;

export interface SpareStrapWish {
  /** A kind of strap asked for: "a spare NATO". */
  type?: Strap["type"];
  colors: ColorName[];
  /** The customer's own words for those colours, for replies. */
  colorWords: string[];
}

export interface ExtrasIntent {
  /** Add-on ids asked for, in the order they were mentioned. */
  add: string[];
  /** Add-on ids to take out: "no box", "remove the gift wrapping". */
  remove: string[];
  /** A spare strap asked for, with any kind or colour named for it. */
  spareStrap?: SpareStrapWish;
  /** "Remove the spare strap", "no second strap". */
  removeSpareStrap: boolean;
  /** The watch is a gift ("it's a gift"): gift wrapping, and a presentation box when nothing else holds it. */
  gift: boolean;
}

export interface ParsedExtras {
  intent: ExtrasIntent;
  /**
   * Positions of the tokens that were about the extras ("spare olive NATO", "travel pouch"), so they
   * aren't read as wishes for the watch itself (its strap, or a travel GMT).
   */
  consumed: Set<number>;
}

const { box, pouch, tool, giftWrap, regulation, certificate } = ADD_ON_IDS;

/** Token sequences naming each add-on; the longest match wins. */
const ADD_ON_PHRASES: [string, string[]][] = [
  [box, ["presentation box", "gift box", "watch box", "wooden box", "wood box", "box", "boxes", "boxed"]],
  [pouch, ["leather travel pouch", "travel pouch", "leather pouch", "watch pouch", "pouch", "pouches"]],
  [
    tool,
    [
      "spring bar tool",
      "springbar tool",
      "spring bar remover",
      "strap changing tool",
      "strap change tool",
      "strap removal tool",
      "strap tool",
      "strap tools",
      "strap changer",
      "tool to change the strap",
      "tool to change straps",
      "tool to change the straps",
      "tool for changing straps",
      "tool for changing the strap",
    ],
  ],
  [
    giftWrap,
    [
      "gift wrap",
      "gift wrapped",
      "gift wrapping",
      "giftwrap",
      "giftwrapped",
      "wrap it",
      "wrapped",
      "wrapping",
      "handwritten card",
      "greeting card",
      "a card",
    ],
  ],
  [
    regulation,
    [
      "as accurate as possible",
      "as precise as possible",
      "more accurate",
      "most accurate",
      "extra accurate",
      "very accurate",
      "highly accurate",
      "fine regulation",
      "extra regulation",
      "regulated",
      "regulation",
      "regulate it",
      "fine tune",
      "fine tuned",
      "finely tuned",
      "fine tuning",
    ],
  ],
  [certificate, ["timing certificate", "certificate", "timing card", "timing sheet", "timing report", "timegrapher readings"]],
];

/** "It's a gift": the occasion, rather than a request for wrapping. A lone "gift" counts too. */
const GIFT_PHRASES = [
  "its a present",
  "it is a present",
  "as a present",
  "a present for",
  "birthday present",
  "christmas present",
  "anniversary present",
  "wedding present",
];

const SPARE_CUES = new Set(["spare", "extra", "second", "another", "additional", "backup", "2nd"]);
const STRAP_NOUNS = new Set(["strap", "straps", "band", "bands"]);
/** Words that make "strap" part of a tool's name: "an extra strap tool" is the tool. */
const TOOL_WORDS = new Set(["tool", "tools", "changer", "remover"]);
/** "Two straps", "2 straps": the watch's own and a spare. */
const PAIR_WORDS = new Set(["two", "2", "both"]);

const REMOVAL_CUES = new Set([
  "no",
  "without",
  "remove",
  "drop",
  "lose",
  "delete",
  "skip",
  "cancel",
  "forget",
  "ditch",
  "dont",
  "not",
  "out",
  "exclude",
]);
/** Words that may sit between a removal cue and what it removes: "no need for a box". */
const REMOVAL_FILLERS = new Set(["the", "a", "an", "any", "need", "for", "want", "to", "it", "my", "your", "that", "this", "of"]);
/** Words that carry a removal on to the next extra: "remove the box and the pouch". */
const CHAIN_WORDS = new Set(["and", "or", "the", "a", "an", "its", "nor"]);
/** How far back a removal cue may be from what it removes. */
const REMOVAL_WINDOW = 4;

interface Mention {
  start: number;
  end: number;
  removal: boolean;
}

function matchesAt(tokens: string[], at: number, phrase: string[]): boolean {
  return phrase.every((word, offset) => tokens[at + offset] === word);
}

function removalCueBefore(tokens: string[], start: number): boolean {
  for (let i = start - 1; i >= 0 && i >= start - REMOVAL_WINDOW; i--) {
    if (REMOVAL_CUES.has(tokens[i])) return true;
    if (!REMOVAL_FILLERS.has(tokens[i])) return false;
  }
  return false;
}

/** A mention is a removal when a cue comes before it, or it follows a removal in a list. */
function isRemoval(tokens: string[], start: number, previous: Mention | undefined): boolean {
  if (removalCueBefore(tokens, start)) return true;
  if (!previous?.removal) return false;
  const between = tokens.slice(previous.end + 1, start);
  return between.length <= 3 && between.every((word) => CHAIN_WORDS.has(word));
}

/** "the spare strap in the box": the box that ships anyway, not a presentation box. */
function isContentsBox(tokens: string[], at: number): boolean {
  if (tokens[at] !== "box") return false;
  const [before, twoBefore] = [tokens[at - 1], tokens[at - 2]];
  return before === "in" || before === "inside" || (before === "the" && (twoBefore === "in" || twoBefore === "inside" || twoBefore === "into"));
}

/** The longest add-on phrase starting at `at`, if any. */
function addOnAt(tokens: string[], at: number): { id: string; length: number } | undefined {
  let best: { id: string; length: number } | undefined;
  for (const [id, phrases] of ADD_ON_PHRASES) {
    for (const phrase of phrases) {
      const words = phrase.split(" ");
      if (words.length > (best?.length ?? 0) && matchesAt(tokens, at, words)) best = { id, length: words.length };
    }
  }
  return best;
}

interface SpareSpan {
  start: number;
  end: number;
  wish: SpareStrapWish;
}

/**
 * A spare strap named from `cue` onwards: "spare olive NATO strap", "second strap in leather",
 * "two straps". Only colours and kinds of strap may come between the cue and the strap.
 */
function spareAt(tokens: string[], cue: number, strapTypeOf: (word: string) => Strap["type"] | undefined): SpareSpan | undefined {
  const wish: SpareStrapWish = { colors: [], colorWords: [] };
  const describe = (word: string): boolean => {
    const type = strapTypeOf(word);
    const color = colorForWord(word);
    if (type) wish.type ??= type;
    if (color && !wish.colors.includes(color)) {
      wish.colors.push(color);
      wish.colorWords.push(word);
    }
    return Boolean(type || color);
  };
  let end = -1;
  let found = false;
  for (let j = cue + 1; j < tokens.length && j <= cue + 4; j++) {
    const word = tokens[j];
    if (STRAP_NOUNS.has(word)) {
      end = j;
      found = true;
      break;
    }
    if (!describe(word)) break;
    end = j;
    if (strapTypeOf(word)) found = true;
  }
  if (!found || TOOL_WORDS.has(tokens[end + 1])) return undefined;
  // "a second strap in olive leather"
  if (tokens[end + 1] === "in") {
    let j = end + 2;
    while (j < tokens.length && describe(tokens[j])) end = j++;
  }
  // A pair names no kind: "two straps" asks for a spare, not for two NATOs.
  return { start: cue, end, wish: PAIR_WORDS.has(tokens[cue]) ? { colors: [], colorWords: [] } : wish };
}

/** "a NATO as a spare", "the leather one as a second strap". */
function spareBefore(tokens: string[], as: number, strapTypeOf: (word: string) => Strap["type"] | undefined): SpareSpan | undefined {
  const cueAt = tokens[as + 1] === "a" ? as + 2 : as + 1;
  if (tokens[as] !== "as" || !SPARE_CUES.has(tokens[cueAt])) return undefined;
  const end = STRAP_NOUNS.has(tokens[cueAt + 1]) ? cueAt + 1 : cueAt;
  const wish: SpareStrapWish = { colors: [], colorWords: [] };
  let start = as;
  let found = false;
  for (let j = as - 1; j >= 0 && j >= as - 4; j--) {
    const word = tokens[j];
    const type = strapTypeOf(word);
    const color = colorForWord(word);
    if (!type && !color && !STRAP_NOUNS.has(word) && word !== "one") break;
    if (type) wish.type ??= type;
    if (color && !wish.colors.includes(color)) {
      wish.colors.unshift(color);
      wish.colorWords.unshift(word);
    }
    found ||= Boolean(type || STRAP_NOUNS.has(word));
    start = j;
  }
  return found ? { start, end, wish } : undefined;
}

export function parseExtras(tokens: string[], strapTypeOf: (word: string) => Strap["type"] | undefined): ParsedExtras {
  const intent: ExtrasIntent = { add: [], remove: [], removeSpareStrap: false, gift: false };
  const consumed = new Set<number>();
  const consume = (start: number, end: number) => {
    for (let i = start; i <= end; i++) consumed.add(i);
  };
  let previous: Mention | undefined;
  const mention = (start: number, end: number): boolean => {
    const removal = isRemoval(tokens, start, previous);
    previous = { start, end, removal };
    consume(start, end);
    return removal;
  };
  const addOrRemove = (id: string, removal: boolean) => {
    const [into, from] = removal ? [intent.remove, intent.add] : [intent.add, intent.remove];
    if (!into.includes(id)) into.push(id);
    const index = from.indexOf(id);
    if (index >= 0) from.splice(index, 1);
  };

  for (let i = 0; i < tokens.length; i++) {
    const addOn = addOnAt(tokens, i);
    if (addOn && !isContentsBox(tokens, i)) {
      addOrRemove(addOn.id, mention(i, i + addOn.length - 1));
      i += addOn.length - 1;
      continue;
    }
    const spare =
      (SPARE_CUES.has(tokens[i]) || PAIR_WORDS.has(tokens[i]) ? spareAt(tokens, i, strapTypeOf) : undefined) ??
      spareBefore(tokens, i, strapTypeOf);
    if (spare) {
      // A span found looking back ("a rubber one as a spare") starts before this token: those words are about the spare too.
      const removal = mention(spare.start, spare.end);
      if (removal) {
        intent.removeSpareStrap = true;
        intent.spareStrap = undefined;
      } else {
        intent.spareStrap = spare.wish;
        intent.removeSpareStrap = false;
      }
      i = spare.end;
      continue;
    }
    // "no spare", "without the spare": nothing named after it, but clear enough with a removal cue.
    if (tokens[i] === "spare" && removalCueBefore(tokens, i)) {
      mention(i, i);
      intent.removeSpareStrap = true;
      intent.spareStrap = undefined;
      continue;
    }
    if (tokens[i] === "gift" || tokens[i] === "gifts") {
      if (mention(i, i)) addOrRemove(giftWrap, true);
      else intent.gift = true;
      continue;
    }
    const present = GIFT_PHRASES.map((phrase) => phrase.split(" ")).find((words) => matchesAt(tokens, i, words));
    if (present) {
      if (mention(i, i + present.length - 1)) addOrRemove(giftWrap, true);
      else intent.gift = true;
      i += present.length - 1;
    }
  }
  if (intent.remove.includes(giftWrap)) intent.gift = false;
  return { intent, consumed };
}

export function wantsExtras(intent: ExtrasIntent): boolean {
  return intent.add.length > 0 || intent.remove.length > 0 || intent.spareStrap !== undefined || intent.removeSpareStrap || intent.gift;
}
