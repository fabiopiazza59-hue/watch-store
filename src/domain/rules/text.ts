/**
 * Text review for dial printing and caseback engraving: length, printable characters, other watch
 * companies' trademarks and protected Swiss indications.
 *
 * Names are matched against the text's words (lowercased, compatibility forms such as fullwidth
 * letters folded to plain ones, accents stripped, punctuation treated as a space, apostrophes dropped)
 * glued back together, so "Rolex", "R O L E X", "ＲＯＬＥＸ", "tag-heuer" and "TagHeuer" all match.
 * Two matching modes keep ordinary words printable:
 * - `word`: the name must cover whole words. For short or ambiguous names: "tag" catches "TAG" and
 *   "T.A.G." but not "Vintage" or "Stage"; "oris" does not catch "Doris".
 * - `affix`: the name may also start or end inside a word, catching "Rolexes" and "MyRolex", but
 *   never spans the middle of unrelated words ("Carole Xu" is not "Rolex", "Home Game" is not
 *   "Omega"). For long, distinctive names.
 * Look-alike substitutions ("R0LEX") are deliberately out of scope.
 */
import type { Personalization } from "../types";

interface ProtectedName {
  /** How the name is shown back to the customer. */
  label: string;
  word?: string[];
  affix?: string[];
}

/** Watch brands and flagship model names we never print or engrave. */
const WATCH_TRADEMARKS: ProtectedName[] = [
  { label: "Rolex", affix: ["Rolex"] },
  { label: "Tudor", word: ["Tudor"] },
  { label: "Omega", affix: ["Omega"] },
  { label: "Seiko", affix: ["Seiko"] },
  { label: "Patek Philippe", affix: ["Patek Philippe", "Patek"] },
  { label: "Audemars Piguet", affix: ["Audemars Piguet", "Audemars"] },
  { label: "Vacheron Constantin", affix: ["Vacheron"] },
  { label: "Cartier", affix: ["Cartier"] },
  { label: "Breitling", affix: ["Breitling"] },
  { label: "TAG Heuer", word: ["TAG", "Heuer"], affix: ["TAG Heuer"] },
  { label: "Longines", affix: ["Longines"] },
  { label: "Tissot", affix: ["Tissot"] },
  { label: "Hublot", affix: ["Hublot"] },
  { label: "IWC", word: ["IWC"] },
  { label: "Panerai", affix: ["Panerai"] },
  { label: "Jaeger-LeCoultre", affix: ["LeCoultre"] },
  { label: "Zenith", word: ["Zenith"] },
  { label: "Oris", word: ["Oris"] },
  { label: "Sinn", word: ["Sinn"] },
  { label: "Casio", affix: ["Casio"] },
  { label: "G-Shock", affix: ["G-Shock"] },
  { label: "Citizen", word: ["Citizen"] },
  { label: "Hamilton", word: ["Hamilton"] },
  { label: "Blancpain", affix: ["Blancpain"] },
  { label: "Rado", word: ["Rado"] },
  { label: "Breguet", affix: ["Breguet"] },
  { label: "A. Lange & Söhne", affix: ["Lange & Söhne", "Lange und Söhne", "Lange & Soehne", "Lange und Soehne"] },
  { label: "Chopard", affix: ["Chopard"] },
  { label: "Bulova", affix: ["Bulova"] },
  { label: "Swatch", word: ["Swatch"] },
  { label: "Richard Mille", word: ["Richard Mille"] },
  { label: "Montblanc", word: ["Montblanc"] },
  { label: "Nomos", word: ["Nomos"] },
  { label: "Glashütte Original", word: ["Glashütte Original", "Glashuette Original"] },
  { label: "Orient", word: ["Orient"] },
  { label: "Timex", affix: ["Timex"] },
  { label: "Fossil", word: ["Fossil"] },
  { label: "Movado", affix: ["Movado"] },
  { label: "Piaget", affix: ["Piaget"] },
  { label: "Ulysse Nardin", word: ["Ulysse Nardin"] },
  { label: "Girard-Perregaux", affix: ["Perregaux"] },
  { label: "Bell & Ross", word: ["Bell & Ross"] },
  { label: "Baume & Mercier", affix: ["Baume & Mercier"] },
  { label: "Raymond Weil", word: ["Raymond Weil"] },
  { label: "Frédérique Constant", word: ["Frédérique Constant"] },
  { label: "Maurice Lacroix", word: ["Maurice Lacroix"] },
  { label: "Christopher Ward", word: ["Christopher Ward"] },
  { label: "Junghans", affix: ["Junghans"] },
  { label: "Certina", affix: ["Certina"] },
  { label: "Mido", word: ["Mido"] },
  { label: "Doxa", word: ["Doxa"] },
  { label: "Squale", word: ["Squale"] },
  { label: "Luminox", affix: ["Luminox"] },
  { label: "Victorinox", affix: ["Victorinox"] },
  { label: "Invicta", word: ["Invicta"] },
  { label: "Bremont", word: ["Bremont"] },
  { label: "Steinhart", word: ["Steinhart"] },
  { label: "Submariner", affix: ["Submariner"] },
  { label: "Sea-Dweller", affix: ["Sea-Dweller"] },
  { label: "Datejust", affix: ["Datejust"] },
  { label: "GMT-Master", affix: ["GMT-Master"] },
  { label: "Speedmaster", affix: ["Speedmaster"] },
  { label: "Seamaster", affix: ["Seamaster"] },
  { label: "Navitimer", affix: ["Navitimer"] },
  { label: "Aquanaut", affix: ["Aquanaut"] },
  { label: "Royal Oak", word: ["Royal Oak"] },
];

/** Indications of Swiss origin, reserved by Swiss law for watches that qualify. */
const PROTECTED_INDICATIONS: ProtectedName[] = [
  {
    label: "Swiss",
    affix: ["Swiss", "Suisse", "Switzerland", "Schweiz", "Svizzera"],
    word: ["Suiza"],
  },
  { label: "Genève", affix: ["Genève", "Geneva"], word: ["Genf", "Ginevra"] },
];

/** Punctuation allowed besides letters, digits and spaces. */
export const ALLOWED_PUNCTUATION = [".", ",", "'", "&", "-"] as const;
const ALLOWED_SYMBOLS = new Set<string>([" ", ...ALLOWED_PUNCTUATION]);

/**
 * Lowercase, compatibility forms folded, accents stripped, whitespace collapsed:
 * "  Genève  Swiss " → "geneve swiss", "Ｏｍｅｇａ" → "omega", "ﬁeld" → "field".
 */
export function normalizeText(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Typographic marks that phones and word processors type in place of `'` and `-`. */
const TYPOGRAPHIC_PUNCTUATION: [RegExp, string][] = [
  [/[\u2018\u2019\u02BC\u2032]/g, "'"],
  [/[\u2010-\u2015\u2212]/g, "-"],
];

/**
 * Personalization text as it should be stored and printed: typographic apostrophes (’ ‘ ʼ ′) become
 * `'` and dashes (‐ – — −) become `-`, so "Grandpa’s" typed with smart punctuation is accepted as
 * "Grandpa's". Apply it wherever customer text enters a spec; `reviewText` stays strict.
 */
export function normalizePersonalizationText(text: string): string {
  return TYPOGRAPHIC_PUNCTUATION.reduce((result, [marks, ascii]) => result.replace(marks, ascii), text);
}

/** Both personalization texts through normalizePersonalizationText. */
export function normalizePersonalization(personalization: Personalization): Personalization {
  return {
    dialText: normalizePersonalizationText(personalization.dialText),
    casebackEngraving: normalizePersonalizationText(personalization.casebackEngraving),
  };
}

/**
 * Normalised words, punctuation acting as a separator: "Tag-Heuer, Genève" → ["tag", "heuer", "geneve"].
 * Apostrophes join rather than split, so "Grandpa's watch" doesn't leave a stray "s" to glue onto
 * "watch" ("swatch").
 */
export function words(text: string): string[] {
  return normalizeText(text)
    .replace(/['’ʼ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The text with all spaces and punctuation removed: "R O L E X" → "rolex". */
export function compactText(text: string): string {
  return words(text).join("");
}

interface CompiledName {
  label: string;
  terms: { compact: string; wholeWords: boolean }[];
}

function compile(names: ProtectedName[]): CompiledName[] {
  return names.map(({ label, word = [], affix = [] }) => ({
    label,
    terms: [
      ...word.map((term) => ({ compact: compactText(term), wholeWords: true })),
      ...affix.map((term) => ({ compact: compactText(term), wholeWords: false })),
    ],
  }));
}

const COMPILED_TRADEMARKS = compile(WATCH_TRADEMARKS);
const COMPILED_INDICATIONS = compile(PROTECTED_INDICATIONS);

/** The compact text plus the offsets where one of its words starts or ends. */
interface WordRun {
  compact: string;
  boundaries: Set<number>;
}

function wordRun(text: string): WordRun {
  const textWords = words(text);
  const boundaries = new Set<number>([0]);
  let offset = 0;
  for (const word of textWords) {
    offset += word.length;
    boundaries.add(offset);
  }
  return { compact: textWords.join(""), boundaries };
}

function containsTerm(run: WordRun, term: CompiledName["terms"][number]): boolean {
  const { compact, boundaries } = run;
  for (let at = compact.indexOf(term.compact); at !== -1; at = compact.indexOf(term.compact, at + 1)) {
    const startsOnWord = boundaries.has(at);
    const endsOnWord = boundaries.has(at + term.compact.length);
    if (term.wholeWords ? startsOnWord && endsOnWord : startsOnWord || endsOnWord) return true;
  }
  return false;
}

function findNames(run: WordRun, names: CompiledName[]): string[] {
  return names.filter((name) => name.terms.some((term) => containsTerm(run, term))).map((name) => name.label);
}

/**
 * Letters of the Latin script (accented ones too), ASCII digits and the allowed symbols. Compatibility
 * forms (fullwidth letters, ligatures such as "ﬁ", superscripts) are refused: they'd be printed as
 * typed, and they are how a brand name slips past a plain-letter check.
 */
function isAllowedCharacter(char: string): boolean {
  if (/^[0-9]$/.test(char) || ALLOWED_SYMBOLS.has(char)) return true;
  return /^\p{L}$/u.test(char) && /^\p{Script=Latin}$/u.test(char) && char.normalize("NFKC") === char;
}

export interface TextReview {
  /** Length in characters of the trimmed text. */
  length: number;
  /** Characters that can't be printed or engraved, each listed once, in order of appearance. */
  disallowedCharacters: string[];
  /** Other watch companies' trademarks found, by display name. */
  trademarks: string[];
  /** Protected Swiss indications found ("Swiss", "Genève"). */
  protectedIndications: string[];
}

export function reviewText(text: string): TextReview {
  const characters = [...text.normalize("NFC").trim()];
  const run = wordRun(text);
  return {
    length: characters.length,
    disallowedCharacters: [...new Set(characters.filter((char) => !isAllowedCharacter(char)))],
    trademarks: findNames(run, COMPILED_TRADEMARKS),
    protectedIndications: findNames(run, COMPILED_INDICATIONS),
  };
}
