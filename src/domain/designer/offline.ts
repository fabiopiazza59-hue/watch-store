// The offline designer: turns a message into a buildable spec with keyword matching and catalogue
// attributes, no AI involved. Used when no API key is configured and whenever the Claude designer
// cannot answer. Deterministic: the same request always gives the same design and reply.
import { CATALOG, DEFAULT_SPEC, findPart, partsForSlot, resolveSpec, TEMPLATES } from "../catalog";
import { evaluateOptions, repairSpec, validateSpec } from "../rules";
import { DESIGN_NAME_MAX_LENGTH } from "../schemas";
import type {
  Catalog,
  DateWindow,
  DesignRequest,
  Dial,
  Issue,
  Part,
  Personalization,
  ResolvedSpec,
  SlotKey,
  Strap,
  WatchCase,
  WatchSpec,
  WatchStyle,
} from "../types";
import { type ColorName, COLOR_WORDS, colorMatch } from "./colors";
import { customerPriceEur, priceFloor, type FloorKind } from "./floors";
import { parseIntent, type DesignIntent, type UnsupportedFeature } from "./intent";
import { SELECTION_ORDER, selectParts, type Selection, type SelectionOptions, type SlotChoice } from "./select";
import type { DesignDraft, FallbackReason } from "./types";

/** Preference points per euro of part cost: a light tie-break, or a strong pull towards a budget. */
const COST_WEIGHT = 0.005;
const BUDGET_COST_WEIGHT = 0.04;
const LEAN_COST_WEIGHT = 0.2;

/** A blocked favourite is only worth explaining when it was clearly the better match. */
const TRADE_OFF_MARGIN = 2;
const MAX_NOTES = 3;
/** A chosen part "has" a requested colour at or above this match. */
const COLOR_MATCH_THRESHOLD = 0.5;
/**
 * What moving to another case costs when weighing an edit against a redesign: a follow-up such as
 * "put it on a black leather strap" shouldn't rebuild the watch around a slightly better match.
 */
const CASE_CHANGE_COST = 2.5;
/** What getting the customer's dial text or engraving onto the watch is worth, per text. */
const TEXT_WEIGHT = 3;

const FALLBACK_NOTES: Record<FallbackReason, string> = {
  "no-key":
    "I'm the workshop's quick designer: I work from keywords, so name a style, colours, a size, a strap or a budget, and put any dial or caseback text in quotes.",
  refusal: "The AI designer couldn't take this request, so the workshop's offline designer answered instead.",
  unavailable: "The AI designer is unavailable right now, so the workshop's offline designer answered instead.",
};

const UNSUPPORTED_NOTES: Record<UnsupportedFeature, string> = {
  quartz:
    "Every watch here runs on an automatic NH3x movement rather than quartz: it winds itself as you wear it and runs about 41 hours off the wrist.",
  tourbillon:
    "A tourbillon isn't possible with the NH3x movements this workshop builds on; they're robust, serviceable automatics, which is what makes hand assembly here practical.",
  chronograph:
    "There's no chronograph in the parts library (the NH3x family has no stopwatch module), but a rotating bezel is a simple, reliable way to time things.",
  moonphase: "The NH3x movements have no moon-phase complication, so that isn't possible with these parts.",
  "gold-case": "There's no gold case in the parts library yet, so any gold here comes from gold-printed (gilt) details.",
  smartwatch: "These are purely mechanical watches: no screens, sensors or batteries.",
  gemstones: "Gem-set dials and bezels aren't part of the parts library.",
  skeleton: "There's no skeleton or open-heart dial in the parts library yet.",
};

const STYLE_LABELS: Record<WatchStyle, string> = {
  diver: "dive",
  field: "field",
  dress: "dress",
  pilot: "pilot",
  gmt: "GMT",
  sport: "sport",
};

const PART_NOUNS: Record<Part["category"], string> = {
  movement: "movement",
  case: "case",
  dial: "dial",
  hands: "hands",
  crystal: "crystal",
  bezelInsert: "bezel insert",
  strap: "strap",
};

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five"];

function listJoin(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/)[0];
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function hasGmt(parts: ResolvedSpec): boolean {
  return Boolean(parts.movement?.complications.includes("gmt"));
}

// ---------------------------------------------------------------------------
// What the customer asked for, as checks on a design
// ---------------------------------------------------------------------------

type WishKey =
  | "style"
  | "dialColor"
  | "gold"
  | "handsColor"
  | "strapType"
  | "strapColor"
  | "bezelColor"
  | "ceramic"
  | "countdown"
  | "date"
  | "gmt"
  | "caliber"
  | "indices"
  | "sunburst"
  | "lume"
  | "material"
  | "blackCase"
  | "displayCaseback"
  | "noBezel"
  | "size"
  | "waterResistance"
  | "mineral";

/** One thing the customer asked for, and how to tell whether a design has it. */
interface Wish {
  key: WishKey;
  /** As a reply phrase: "a leather strap", "no date window". */
  label: string;
  /** The slot that provides it. */
  slot: SlotKey;
  /** How much it matters when weighing a small edit against a redesign. */
  weight: number;
  met(parts: ResolvedSpec): boolean;
}

const DATE_WISHES: Record<DateWindow, string> = {
  none: "a dial without a date window",
  "date-3": "a date window",
  "day-date-3": "a day-date window",
};

/** A day-date window shows the date too, so it answers a wish for "a date". */
function showsDate(window: DateWindow | undefined, wanted: DateWindow): boolean {
  return window === wanted || (wanted === "date-3" && window === "day-date-3");
}

function colorWord(intent: DesignIntent, color: ColorName): string {
  return intent.colorWords[color] ?? color;
}

function hasColor(hex: string | undefined, color: ColorName): boolean {
  return hex !== undefined && colorMatch(hex, color) >= COLOR_MATCH_THRESHOLD;
}

/** "black leather strap", "brown strap", "bracelet". */
function strapWords(type: Strap["type"] | undefined, color?: string): string {
  return [color, type, type === "bracelet" ? undefined : "strap"].filter(Boolean).join(" ");
}

/** Every recognisable wish in the request. `current` is the design the request is about. */
function wishes(intent: DesignIntent, current: ResolvedSpec, catalog: Catalog): Wish[] {
  const list: Wish[] = [];
  const add = (key: WishKey, label: string, slot: SlotKey, weight: number, met: (parts: ResolvedSpec) => boolean) =>
    list.push({ key, label, slot, weight, met });
  const diameters = catalog.cases.map((c) => c.diameterMm);
  const deepest = Math.max(...catalog.cases.map((c) => c.waterResistanceM));

  // A GMT is a function as much as a look: any case with a GMT movement answers "a GMT".
  const { style } = intent;
  if (style === "gmt") add("style", "a GMT", "movementId", 3, (p) => p.case?.style === "gmt" || hasGmt(p));
  else if (style) add("style", `a ${STYLE_LABELS[style]} case`, "caseId", 3, (p) => p.case?.style === style);
  const [dialColor] = intent.colors.dial.filter((color) => color !== "gold");
  if (dialColor && intent.dialPrint.includes(dialColor)) {
    add("dialColor", `${colorWord(intent, dialColor)} details`, "dialId", 2, (p) => hasColor(p.dial?.printColorHex, dialColor));
  } else if (dialColor) {
    add("dialColor", `a ${colorWord(intent, dialColor)} dial`, "dialId", 3, (p) => hasColor(p.dial?.colorHex, dialColor));
  }
  if (intent.colors.dial.includes("gold")) {
    add("gold", "gold details", "dialId", 1, (p) => hasColor(p.dial?.printColorHex, "gold") || hasColor(p.hands?.colorHex, "gold"));
  }
  const [handsColor] = intent.colors.hands;
  if (handsColor) {
    add("handsColor", `${colorWord(intent, handsColor)} hands`, "handsId", 1.5, (p) => hasColor(p.hands?.colorHex, handsColor));
  }
  const { strapType } = intent;
  if (strapType) add("strapType", `a ${strapWords(strapType)}`, "strapId", 3, (p) => p.strap?.type === strapType);
  const [strapColor] = intent.colors.strap;
  if (strapColor) {
    const label = `a ${strapWords(strapType, colorWord(intent, strapColor))}`;
    add("strapColor", label, "strapId", 1, (p) => hasColor(p.strap?.colorHex, strapColor));
  }
  const bezelColors = intent.colors.bezel;
  if (bezelColors.length > 0) {
    add("bezelColor", `a ${bezelColors.map((c) => colorWord(intent, c)).join(" and ")} bezel`, "bezelInsertId", 2, (p) =>
      bezelColors.every((color) => hasColor(p.bezelInsert?.colorHex, color) || hasColor(p.bezelInsert?.secondaryColorHex, color)),
    );
  }
  if (intent.ceramic) add("ceramic", "a ceramic bezel insert", "bezelInsertId", 1, (p) => p.bezelInsert?.material === "ceramic");
  if (intent.countdown) add("countdown", "a countdown bezel", "bezelInsertId", 1, (p) => p.bezelInsert?.scale === "countdown-60");
  const { date } = intent;
  if (date) add("date", DATE_WISHES[date], "dialId", 3, (p) => showsDate(p.dial?.dateWindow, date));
  if (intent.gmt) add("gmt", "a GMT hand", "movementId", 3, hasGmt);
  const { caliber } = intent;
  if (caliber) add("caliber", `the ${caliber}`, "movementId", 2, (p) => p.movement?.caliber === caliber);
  const { indices } = intent;
  if (indices) add("indices", `${indices} numerals`, "dialId", 1, (p) => p.dial?.indices === indices);
  if (intent.sunburst) add("sunburst", "a sunburst dial", "dialId", 1, (p) => p.dial?.texture === "sunburst");
  if (intent.lume) add("lume", "lume", "dialId", 1, (p) => p.dial?.lume !== "none" || p.hands?.lume !== "none");
  const { material } = intent;
  if (material) add("material", `a ${material} case`, "caseId", 3, (p) => p.case?.material === material);
  if (intent.blackCase) add("blackCase", "a black case", "caseId", 2, (p) => p.case?.finish === "PVD black");
  if (intent.displayCaseback) add("displayCaseback", "a display caseback", "caseId", 2, (p) => p.case?.caseback === "display");
  if (intent.noBezel) add("noBezel", "no rotating bezel", "caseId", 2, (p) => p.case?.bezel === "none" || p.case?.bezel === "fixed");
  const size = intent.size;
  const now = current.case?.diameterMm;
  if (size?.kind === "target") add("size", `a ${size.mm}mm case`, "caseId", 2, (p) => Math.abs((p.case?.diameterMm ?? 0) - size.mm) < 1);
  if (size?.kind === "small" && now !== undefined) {
    add("size", "a smaller case", "caseId", 2, (p) => (p.case?.diameterMm ?? now) < now || now === Math.min(...diameters));
  }
  if (size?.kind === "large" && now !== undefined) {
    add("size", "a larger case", "caseId", 2, (p) => (p.case?.diameterMm ?? now) > now || now === Math.max(...diameters));
  }
  if (intent.waterResistanceM !== undefined) {
    const depth = Math.min(intent.waterResistanceM, deepest);
    add("waterResistance", `${depth}m of water resistance`, "caseId", 2, (p) => (p.case?.waterResistanceM ?? 0) >= depth);
  }
  if (intent.mineral) add("mineral", "a mineral crystal", "crystalId", 1, (p) => p.crystal?.material === "mineral");
  return list;
}

// ---------------------------------------------------------------------------
// Designing: a small edit when the request allows one, else a redesign
// ---------------------------------------------------------------------------

interface Design {
  spec: WatchSpec;
  selection: Selection;
  rejectedTexts: { text: string; issue: Issue }[];
}

function requestedPersonalization(base: WatchSpec, intent: DesignIntent): Personalization {
  const current = base.personalization;
  return {
    dialText: intent.dialText ?? (intent.clearDialText ? "" : current.dialText),
    casebackEngraving: intent.casebackEngraving ?? (intent.clearEngraving ? "" : current.casebackEngraving),
  };
}

const TEXT_RULES: [keyof Personalization, string][] = [
  ["dialText", "dial-text"],
  ["casebackEngraving", "caseback-engraving"],
];

/**
 * Picks parts for the requested personalization. Text the rules still reject once parts have been
 * chosen to suit it (a trademark, too long, unprintable characters) is dropped and explained.
 */
function selectDesign(base: WatchSpec, intent: DesignIntent, costWeight: number, catalog: Catalog, options: SelectionOptions): Design {
  const personalization = requestedPersonalization(base, intent);
  const start = { ...base, name: intent.designName ?? base.name, personalization };
  let selection = selectParts(start, base, intent, costWeight, catalog, options);

  const report = validateSpec(selection.spec, catalog);
  const rejectedTexts = TEXT_RULES.flatMap(([field, ruleId]) => {
    const text = personalization[field];
    const issue = report.issues.find((i) => i.ruleId === ruleId && i.severity === "error");
    return issue && text !== base.personalization[field] ? [{ field, text, issue }] : [];
  });
  if (rejectedTexts.length > 0) {
    const kept = { ...personalization };
    for (const { field } of rejectedTexts) kept[field] = base.personalization[field];
    selection = selectParts({ ...start, personalization: kept }, base, intent, costWeight, catalog, options);
  }
  return { spec: repairSpec(selection.spec, catalog).spec, selection, rejectedTexts };
}

/** Parts that follow a slot: a new dial may need another movement and hands, a GMT a 24h insert. */
const FOLLOWERS: Partial<Record<SlotKey, SlotKey[]>> = {
  dialId: ["movementId", "handsId"],
  movementId: ["dialId", "handsId", "bezelInsertId"],
};

const RESOLVED_KEYS: Record<SlotKey, keyof ResolvedSpec> = {
  movementId: "movement",
  caseId: "case",
  dialId: "dial",
  handsId: "hands",
  crystalId: "crystal",
  bezelInsertId: "bezelInsert",
  strapId: "strap",
};

/**
 * Slots whose current part lacks something asked for that another part in the library has: the
 * customer asked for a change there, so keeping the part is only a tie-break.
 */
function unwantedSlots(base: WatchSpec, intent: DesignIntent, catalog: Catalog): Set<SlotKey> {
  const current = resolveSpec(base, catalog);
  const available = (wish: Wish) =>
    wishSlots(wish).some((slot) => partsForSlot(slot, catalog).some((part) => wish.met({ ...current, [RESOLVED_KEYS[slot]]: part })));
  const unmet = wishes(intent, current, catalog).filter((wish) => !wish.met(current) && available(wish));
  return new Set(unmet.flatMap(wishSlots));
}

/**
 * The slots a request leaves alone, so an edit such as "make the strap brown" changes the strap
 * and nothing else. Null when the request describes a whole watch (a style, a budget) or concerns
 * its case.
 */
function untouchedSlots(base: WatchSpec, intent: DesignIntent, catalog: Catalog): Set<SlotKey> | null {
  if (intent.style || intent.budgetEur !== undefined || intent.lean) return null;
  const current = resolveSpec(base, catalog);
  const touched = new Set<SlotKey>();
  const touch = (slot: SlotKey) => [slot, ...(FOLLOWERS[slot] ?? [])].forEach((s) => touched.add(s));
  for (const wish of wishes(intent, current, catalog)) {
    if (wish.met(current)) continue;
    if (wish.slot === "caseId") return null;
    touch(wish.slot);
  }
  if (intent.dialText && current.dial?.printable === false) touch("dialId");
  if (intent.casebackEngraving && current.case?.caseback === "display") return null;
  return new Set(SELECTION_ORDER.filter((slot) => !touched.has(slot)));
}

/** How well a design answers the request: wishes met and texts placed, less the cost of a new case. */
function satisfaction(design: Design, base: WatchSpec, intent: DesignIntent, catalog: Catalog): number {
  if (!validateSpec(design.spec, catalog).buildable) return -Infinity;
  const parts = resolveSpec(design.spec, catalog);
  const met = wishes(intent, resolveSpec(base, catalog), catalog)
    .filter((wish) => wish.met(parts))
    .reduce((total, wish) => total + wish.weight, 0);
  const requested = { dialText: intent.dialText, casebackEngraving: intent.casebackEngraving };
  const texts = TEXT_RULES.filter(([field]) => requested[field] !== undefined && design.spec.personalization[field] === requested[field]);
  return met + TEXT_WEIGHT * texts.length - (design.spec.caseId !== base.caseId ? CASE_CHANGE_COST : 0);
}

/**
 * The redesign that best fits the request, or, when the request only concerns some parts, an edit
 * of just those parts if it answers the request as well once a new case is counted as a cost.
 */
function design(base: WatchSpec, intent: DesignIntent, costWeight: number, catalog: Catalog, lean = false): Design {
  const unwanted = unwantedSlots(base, intent, catalog);
  const redesign = selectDesign(base, intent, costWeight, catalog, { lean, unwanted });
  const locked = untouchedSlots(base, intent, catalog);
  if (!locked) return redesign;
  const edit = selectDesign(base, intent, costWeight, catalog, { locked, unwanted });
  return satisfaction(edit, base, intent, catalog) >= satisfaction(redesign, base, intent, catalog) ? edit : redesign;
}

function floorKind(intent: DesignIntent): FloorKind {
  return intent.gmt ? { gmt: true } : intent.style ? { style: intent.style } : {};
}

/**
 * With a budget, parts are chosen with cost in mind. When that is still too expensive, a leaner
 * version that trades away preferences is used only if it fits the budget; otherwise the customer
 * gets the design they described, and the reply says what that kind of watch starts at.
 * "Make it cheaper" without a figure goes straight to the lean version.
 */
function designWithinBudget(base: WatchSpec, intent: DesignIntent, catalog: Catalog): Design {
  if (intent.budgetEur === undefined) {
    return intent.lean ? design(base, intent, LEAN_COST_WEIGHT, catalog, true) : design(base, intent, COST_WEIGHT, catalog);
  }
  const preferred = design(base, intent, BUDGET_COST_WEIGHT, catalog);
  if (customerPriceEur(preferred.spec, catalog) <= intent.budgetEur) return preferred;
  const lean = design(base, intent, LEAN_COST_WEIGHT, catalog, true);
  if (customerPriceEur(lean.spec, catalog) <= intent.budgetEur) return lean;
  // Over budget either way: the leaner one, unless it gives up something the customer asked for
  // or saves money with a compromise the preferred design avoids.
  const leanParts = resolveSpec(lean.spec, catalog);
  const keepsWishes = wishes(intent, resolveSpec(base, catalog), catalog).every((wish) => wish.met(leanParts));
  return keepsWishes && warningCount(lean.spec, catalog) <= warningCount(preferred.spec, catalog) ? lean : preferred;
}

function warningCount(spec: WatchSpec, catalog: Catalog): number {
  return validateSpec(spec, catalog).issues.filter((issue) => issue.severity === "warning").length;
}

// ---------------------------------------------------------------------------
// The reply
// ---------------------------------------------------------------------------

function materialLabel(parts: ResolvedSpec): string {
  const watchCase = parts.case;
  if (!watchCase) return "";
  if (watchCase.finish === "PVD black") return "black PVD";
  return watchCase.material === "316L steel" ? "steel" : watchCase.material;
}

function strapPhrase(parts: ResolvedSpec): string {
  const strap = parts.strap;
  if (!strap) return "";
  return strap.type === "bracelet" ? `on the ${strap.name}` : `on the ${strap.name} strap`;
}

function describeDesign(parts: ResolvedSpec): string {
  const { case: watchCase, dial, hands, bezelInsert } = parts;
  if (!watchCase || !dial || !hands) return "Here's a starting point for your design.";
  const insert = bezelInsert ? `, a ${bezelInsert.name} insert` : "";
  return (
    `Here's a ${watchCase.diameterMm}mm ${materialLabel(parts)} ${STYLE_LABELS[watchCase.style]} watch: the ${watchCase.name} case with the ` +
    `${dial.name} dial and ${hands.name} hands${insert}, ${strapPhrase(parts)}.`
  );
}

/** For small edits ("make the strap brown"), name just the parts that changed. */
function describeEdit(before: WatchSpec, after: WatchSpec, catalog: Catalog): string | undefined {
  const swapped = SELECTION_ORDER.filter((slot) => before[slot] !== after[slot]);
  if (swapped.length > 2) return undefined;
  const names = swapped.map((slot) => {
    const part = findPart(after[slot], catalog);
    return part ? `the ${part.name} ${PART_NOUNS[part.category]}` : "no bezel insert";
  });
  return `I've swapped in ${listJoin(names)}.`;
}

function unrecognisedReply(message: string, intent: DesignIntent, catalog: Catalog): string {
  const diameters = catalog.cases.map((c) => c.diameterMm);
  const english = intent.foreign ? " I understand English keywords best." : "";
  if (message.trim().endsWith("?")) {
    return (
      "I can't answer questions, but I can change the design: tell me a style, colours, a size, a strap or a budget, " +
      `and the part pickers show each part's details.${english}`
    );
  }
  return (
    "I couldn't turn that into a design change. I understand styles (dive, field, dress, pilot, GMT, sport), colours, " +
    `sizes from ${Math.min(...diameters)} to ${Math.max(...diameters)}mm, straps, budgets in euros, and text in quotes ` +
    `for the dial or caseback.${english}`
  );
}

/**
 * The reply's first sentence. When nothing changed, it only claims the design already has what
 * was asked for when every recognised wish is met and no note follows; otherwise the notes lead.
 */
function opening(
  before: WatchSpec | undefined,
  after: WatchSpec,
  message: string,
  intent: DesignIntent,
  catalog: Catalog,
  explained: boolean,
): string {
  const parts = resolveSpec(after, catalog);
  const partsChanged = before && SELECTION_ORDER.some((slot) => before[slot] !== after[slot]);
  if (before && partsChanged) return describeEdit(before, after, catalog) ?? describeDesign(parts);
  if (!intent.recognised) return unrecognisedReply(message, intent, catalog);
  if (!before) return describeDesign(parts);
  const textChanged =
    before.personalization.dialText !== after.personalization.dialText ||
    before.personalization.casebackEngraving !== after.personalization.casebackEngraving;
  if (textChanged) return "I've kept every part as it is.";
  if (after.name !== before.name) return `I've named the design '${after.name}'.`;
  // The notes that follow say what couldn't be done and why; they are the answer.
  if (explained) return "";
  return "Your current design already has that, so I've kept it as it is.";
}

function brandNote(intent: DesignIntent): string | undefined {
  if (intent.brands.length === 0) return undefined;
  const plural = intent.brands.length > 1;
  return (
    `${listJoin(intent.brands)} ${plural ? "are other companies' trademarks" : "is another company's trademark"}, ` +
    `so I can't put ${plural ? "those names" : "that name"} or any logo on your watch, but this design is in the same spirit.`
  );
}

function nameNotes(intent: DesignIntent, name: string): string[] {
  const notes: string[] = [];
  if (intent.rejectedName) {
    const { text, marks } = intent.rejectedName;
    notes.push(`I can't name the design '${text}': ${listJoin(marks)} isn't ours to use. Pick an original name and I'll use it.`);
  }
  if (intent.nameShortened) {
    notes.push(`Design names can be up to ${DESIGN_NAME_MAX_LENGTH} characters, so I've shortened it to '${name}'.`);
  }
  return notes;
}

const SWISS_NOTE =
  "'Swiss Made' and other Swiss indications are reserved for watches that meet Swiss origin rules; ours are built around NH-family movements, so they can't carry them.";

function textNotes(before: Personalization, after: Personalization, rejected: Design["rejectedTexts"]): string[] {
  const rejections = rejected.map(({ text, issue }) => `I couldn't use '${text}': ${lowerFirst(issue.message)}`);
  const confirmations: string[] = [];
  if (after.dialText && after.dialText !== before.dialText) {
    confirmations.push(`'${after.dialText}' will be printed on the dial above 6 o'clock.`);
  }
  if (after.casebackEngraving && after.casebackEngraving !== before.casebackEngraving) {
    confirmations.push(`'${after.casebackEngraving}' will be laser-engraved on the solid caseback.`);
  }
  return [...rejections, ...confirmations];
}

function unquotedTextNote(intent: DesignIntent): string | undefined {
  if (intent.unquotedText === "caseback") return "Put the words you'd like engraved in quotes, for example: engrave 'For Sam' on the back.";
  if (intent.unquotedText === "dial") return "Put the words you'd like on the dial in quotes, for example: print 'Est. 2026' on the dial.";
  return undefined;
}

/** Compares the size asked for with the case delivered, never claiming a size it isn't. */
function sizeNote(intent: DesignIntent, parts: ResolvedSpec, catalog: Catalog): string | undefined {
  const watchCase = parts.case;
  if (intent.size?.kind !== "target" || !watchCase) return undefined;
  const target = intent.size.mm;
  const delivered = watchCase.diameterMm;
  if (Math.abs(delivered - target) < 1) return undefined;
  const diameters = catalog.cases.map((c) => c.diameterMm);
  const [smallest, largest] = [Math.min(...diameters), Math.max(...diameters)];
  const style = STYLE_LABELS[watchCase.style];
  if (target < smallest || target > largest) {
    const range = `Our cases run from ${smallest} to ${largest}mm`;
    if (delivered === smallest || delivered === largest) {
      return `${range}, so this ${delivered}mm case is as ${delivered === smallest ? "compact" : "big"} as I can go.`;
    }
    return `${range}; the closest ${style} case is the ${watchCase.name} at ${delivered}mm.`;
  }
  return `Our ${style} cases don't come in ${target}mm, so this is the ${watchCase.name} at ${delivered}mm.`;
}

function waterResistanceNote(intent: DesignIntent, catalog: Catalog): string | undefined {
  const deepest = Math.max(...catalog.cases.map((c) => c.waterResistanceM));
  if (intent.waterResistanceM === undefined || intent.waterResistanceM <= deepest) return undefined;
  return `Our most water-resistant cases are rated ${deepest}m, so that's as deep as these watches go.`;
}

const DATE_PHRASES: Record<DateWindow, { wanted: string; shown: string }> = {
  none: { wanted: "without a date window", shown: "has no date window" },
  "date-3": { wanted: "with a date window", shown: "shows the date" },
  "day-date-3": { wanted: "with a day-date window", shown: "shows the day and date" },
};

/** When the dial's window isn't the one asked for, say so instead of quietly giving the opposite. */
function dateNote(intent: DesignIntent, parts: ResolvedSpec): string | undefined {
  const dial = parts.dial;
  if (!intent.date || !dial || showsDate(dial.dateWindow, intent.date)) return undefined;
  const [color] = intent.colors.dial.filter((c) => c !== "gold");
  const kind = color && hasColor(dial.colorHex, color) ? `${colorWord(intent, color)} dial` : "dial";
  return `No ${kind} ${DATE_PHRASES[intent.date].wanted} fits this case, so the ${dial.name} dial ${DATE_PHRASES[dial.dateWindow].shown}.`;
}

/**
 * Explains the most telling part the rules ruled out: one the customer's wishes pointed to, or the
 * current part when its own constraints (not the other new parts) rule it out.
 */
function tradeOffNote(choices: SlotChoice[], base: WatchSpec, asked: ReadonlySet<SlotKey>): { slot: SlotKey; note: string } | undefined {
  for (const { slot, locked, chosen, ranked } of choices) {
    const [favourite] = ranked;
    if (locked || !favourite.blocker || !favourite.part || !chosen.part) continue;
    const ownConstraint = favourite.blocker.slots.every((s) => s === slot);
    const wished = asked.has(slot) && favourite.partId !== base[slot] && favourite.score - chosen.score >= TRADE_OFF_MARGIN;
    if (wished || ownConstraint) return { slot, note: blockedNote(favourite.blocker, chosen.part, chosen.partId === base[slot]) };
  }
  return undefined;
}

/**
 * Why a better-matching part was ruled out, and what was used instead. When the only thing in the
 * way is the customer's own text, say so: they may prefer the part to the personalization.
 */
function blockedNote(blocker: Issue, chosen: Part, keptCurrent: boolean): string {
  const noun = PART_NOUNS[chosen.category];
  const choice = keptCurrent ? `So I've kept the ${chosen.name} ${noun}.` : `So I went with the ${chosen.name} ${noun} instead.`;
  const textHint =
    blocker.ruleId === "dial-text"
      ? " Remove the dial text if you'd rather have that dial."
      : blocker.ruleId === "caseback-engraving"
        ? " Remove the engraving if you'd rather have that case."
        : "";
  return `${firstSentence(blocker.message)} ${choice}${textHint}`;
}

/** When the dial isn't the colour asked for, say whether the library lacks it or the rules ruled it out. */
function colorNote(intent: DesignIntent, choices: SlotChoice[], base: WatchSpec, catalog: Catalog): string | undefined {
  const [wanted] = intent.colors.dial.filter((color) => color !== "gold" && !intent.dialPrint.includes(color));
  const dialChoice = choices.find(({ slot }) => slot === "dialId");
  const dial = dialChoice?.chosen.part;
  if (!wanted || !dialChoice || !dial || dial.category !== "dial") return undefined;
  if (hasColor(dial.colorHex, wanted)) return undefined;
  const word = colorWord(intent, wanted);
  const keptCurrent = dialChoice.chosen.partId === base.dialId;
  if (!catalog.dials.some((d) => hasColor(d.colorHex, wanted))) {
    const choice = keptCurrent ? "I've kept" : "I went with";
    return `There's no ${word} dial in the parts library yet, so ${choice} the ${dial.name} dial.`;
  }
  const blocked = dialChoice.ranked.find(({ part, blocker }) => blocker && part?.category === "dial" && hasColor(part.colorHex, wanted));
  if (blocked?.blocker) return blockedNote(blocked.blocker, dial, keptCurrent);
  return keptCurrent
    ? `None of the ${word} dials fit this case, so I've kept the ${dial.name} dial.`
    : `None of the ${word} dials fit this case, so I went with the ${dial.name} dial.`;
}

function strapNote(intent: DesignIntent, parts: ResolvedSpec): string | undefined {
  const { strap, case: watchCase } = parts;
  if (!strap || !watchCase) return undefined;
  const lugs = `${watchCase.lugWidthMm}mm`;
  if (intent.strapType && strap.type !== intent.strapType) {
    return `There's no ${intent.strapType} strap for the ${lugs} lugs of this case, so it's on the ${strap.name} instead.`;
  }
  const [color] = intent.colors.strap;
  if (color && !hasColor(strap.colorHex, color)) {
    return `There's no ${strapWords(intent.strapType, colorWord(intent, color))} in ${lugs} for this case, so it's on the ${strap.name}.`;
  }
  return undefined;
}

function caseNotes(intent: DesignIntent, parts: ResolvedSpec, catalog: Catalog): string[] {
  const watchCase = parts.case;
  if (!watchCase) return [];
  const notes: string[] = [];
  const style = STYLE_LABELS[watchCase.style];
  if (intent.displayCaseback && watchCase.caseback !== "display") {
    const display = catalog.cases.filter((c) => c.caseback === "display").map((c) => `the ${c.name}`);
    notes.push(
      display.length > 0
        ? `None of our ${style} cases has a display caseback; ${listJoin(display)} is the one that shows the movement.`
        : "None of our cases has a display caseback yet.",
    );
  }
  if (intent.noBezel && watchCase.insertMm) {
    notes.push(
      `The ${watchCase.name}'s rotating bezel is part of the case, so it can't be removed; for a watch without one, ask for a field, pilot or dress watch.`,
    );
  }
  if ((intent.colors.bezel.length > 0 || intent.ceramic || intent.countdown) && !watchCase.insertMm) {
    notes.push(`The ${watchCase.name} has a fixed bezel with no insert, so there's no bezel to change.`);
  }
  return notes;
}

/** Where a wish can come from: gold details from the dial's print or from the hands. */
function wishSlots(wish: Wish): SlotKey[] {
  return wish.key === "gold" ? ["dialId", "handsId"] : [wish.slot];
}

/** True when some part that grants the wish fits the design's case, whatever else would need to change. */
function caseCanTake(wish: Wish, spec: WatchSpec, catalog: Catalog): boolean {
  const current = resolveSpec(spec, catalog);
  return wishSlots(wish).some((slot) =>
    evaluateOptions(slot, spec, catalog).some(({ partId, issues }) => {
      const part = findPart(partId, catalog);
      const clash = issues.some((issue) => issue.severity === "error" && issue.slots.every((s) => s === slot || s === "caseId"));
      return part !== undefined && !clash && wish.met({ ...current, [RESOLVED_KEYS[slot]]: part });
    }),
  );
}

/** When the case of the design on screen changed although nobody asked for that, name what forced it. */
function caseChangeNote(intent: DesignIntent, before: WatchSpec | undefined, parts: ResolvedSpec, catalog: Catalog): string | undefined {
  if (!before || intent.style) return undefined;
  const current = resolveSpec(before, catalog);
  if (!parts.case || !current.case || parts.case.id === current.case.id) return undefined;
  if (intent.casebackEngraving && current.case.caseback === "display") return undefined;
  const asked = wishes(intent, current, catalog);
  if (asked.some((wish) => wish.slot === "caseId" && !wish.met(current))) return undefined;
  const forcing = asked.filter((wish) => !wish.met(current) && wish.met(parts) && !caseCanTake(wish, before, catalog));
  if (forcing.length === 0) return undefined;
  return `The ${current.case.name} can't take ${listJoin(forcing.map((wish) => wish.label))}, so I moved to the ${parts.case.name} case.`;
}

function budgetNote(intent: DesignIntent, base: WatchSpec, result: Design, catalog: Catalog): string | undefined {
  const price = customerPriceEur(result.spec, catalog);
  const { budgetEur } = intent;
  if (budgetEur === undefined) {
    if (!intent.lean) return undefined;
    const before = customerPriceEur(base, catalog);
    return price < before
      ? `It now comes to about €${price}, down from about €${before}.`
      : `At about €${price}, this is already about as affordable as this design gets.`;
  }
  const kind = floorKind(intent);
  const kindLabel = kind.gmt ? "GMT" : kind.style ? STYLE_LABELS[kind.style] : undefined;
  const floor = priceFloor(kind, catalog);
  const parts = resolveSpec(result.spec, catalog);
  if (price <= budgetEur) {
    const dropped = (kind.style !== undefined && parts.case?.style !== kind.style) || (kind.gmt && !hasGmt(parts));
    if (dropped && floor && parts.case) {
      return (
        `Our ${kindLabel} watches start at about €${floor.priceEur}, so this €${price} ${STYLE_LABELS[parts.case.style]} watch ` +
        `is the closest I can get within €${budgetEur}.`
      );
    }
    return `It comes to about €${price}, within your €${budgetEur} budget.`;
  }
  if (!floor || floor.priceEur >= price) {
    return `It comes to about €${price}, over your €${budgetEur} budget even with the more affordable parts.`;
  }
  const start = kindLabel ? `our ${kindLabel} watches start at about €${floor.priceEur}` : `our most affordable watch is about €${floor.priceEur}`;
  return `It comes to about €${price}, over your €${budgetEur} budget; ${start}.`;
}

/** Wishes the design doesn't meet that no specific note explains, named plainly. */
function unmetNote(intent: DesignIntent, base: WatchSpec, parts: ResolvedSpec, explained: ReadonlySet<WishKey>, catalog: Catalog) {
  const unmet = wishes(intent, resolveSpec(base, catalog), catalog).filter((wish) => !explained.has(wish.key) && !wish.met(parts));
  if (unmet.length === 0) return undefined;
  return `I couldn't also give it ${listJoin(unmet.map((wish) => wish.label))}: no part for that fits with the rest of this design.`;
}

/** "I don't want a diver" about a diver: ask what it should be instead of guessing. */
function styleQuestion(intent: DesignIntent, parts: ResolvedSpec): string | undefined {
  const style = parts.case?.style;
  if (intent.style || !style || !intent.rejectedStyles.includes(style)) return undefined;
  const others = (Object.keys(STYLE_LABELS) as WatchStyle[]).filter((s) => !intent.rejectedStyles.includes(s)).map((s) => STYLE_LABELS[s]);
  return `Which style would you like instead: ${listJoin(others).replace(/ and ([^ ]+)$/, " or $1")}?`;
}

function statusLine(spec: WatchSpec, catalog: Catalog): string | undefined {
  const report = validateSpec(spec, catalog);
  if (!report.buildable) return "I couldn't make every part fit yet; the build check shows what still needs sorting.";
  const warnings = report.issues.filter((issue) => issue.severity === "warning");
  if (warnings.length === 0) return undefined;
  if (warnings.length === 1) return `One thing to know: ${lowerFirst(warnings[0].message)}`;
  const count = COUNT_WORDS[warnings.length] ?? String(warnings.length);
  return `${count} things to know: ${warnings.map((warning) => lowerFirst(firstSentence(warning.message))).join(" Also, ")}`;
}

interface Note {
  text: string | undefined;
  /** The wishes this note explains, so they aren't listed again as unmet. */
  covers?: WishKey[];
}

function composeReply(req: DesignRequest, base: WatchSpec, intent: DesignIntent, result: Design, fallback: FallbackReason, catalog: Catalog) {
  const parts = resolveSpec(result.spec, catalog);
  const asked = new Set(wishes(intent, resolveSpec(base, catalog), catalog).flatMap(wishSlots));
  if (intent.dialText) asked.add("dialId");
  if (intent.casebackEngraving) asked.add("caseId");
  const tradeOff = tradeOffNote(result.selection.choices, base, asked);
  const candidates: Note[] = [
    { text: styleQuestion(intent, parts) },
    { text: brandNote(intent) },
    ...nameNotes(intent, result.spec.name).map((text) => ({ text })),
    { text: intent.swiss ? SWISS_NOTE : undefined },
    ...intent.unsupported.slice(0, 1).map((feature) => ({ text: UNSUPPORTED_NOTES[feature] })),
    { text: unquotedTextNote(intent) },
    { text: waterResistanceNote(intent, catalog), covers: ["waterResistance"] },
    { text: sizeNote(intent, parts, catalog), covers: ["size"] },
    ...textNotes(base.personalization, result.spec.personalization, result.rejectedTexts).map((text) => ({ text })),
    { text: budgetNote(intent, base, result, catalog), covers: ["style", "gmt"] },
    { text: dateNote(intent, parts), covers: ["date"] },
    { text: tradeOff?.note, covers: tradeOff?.slot === "dialId" ? ["dialColor"] : tradeOff?.slot === "strapId" ? ["strapType", "strapColor"] : [] },
    { text: tradeOff?.slot === "dialId" ? undefined : colorNote(intent, result.selection.choices, base, catalog), covers: ["dialColor"] },
    { text: tradeOff?.slot === "strapId" ? undefined : strapNote(intent, parts), covers: ["strapType", "strapColor"] },
    ...caseNotes(intent, parts, catalog).map((text) => ({ text, covers: ["displayCaseback", "noBezel", "bezelColor", "ceramic", "countdown"] as WishKey[] })),
    { text: caseChangeNote(intent, req.currentSpec, parts, catalog) },
  ];
  const given = candidates.filter((note): note is Note & { text: string } => Boolean(note.text));
  const explained = new Set(given.flatMap((note) => note.covers ?? []));
  const unmet = intent.recognised ? unmetNote(intent, base, parts, explained, catalog) : undefined;
  const notes = [...new Set([...given.map((note) => note.text), ...(unmet ? [unmet] : [])])].slice(0, MAX_NOTES);

  const lead = opening(req.currentSpec, result.spec, req.message, intent, catalog, notes.length > 0);
  // The unrecognised-message answer mentions English itself.
  const english = intent.foreign && intent.recognised ? "I understand English keywords best, so tell me if I missed anything." : undefined;
  // The introduction is for a first message, and the "didn't understand" answer already covers it.
  const firstTurn = (req.history?.length ?? 0) === 0;
  const introduce = fallback !== "no-key" || (firstTurn && intent.recognised);
  return [lead, ...notes, statusLine(result.spec, catalog), english, introduce ? FALLBACK_NOTES[fallback] : undefined]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

/** Names nobody chose: blank, the default design's, or a starting template's. */
const GENERIC_NAMES = new Set(["", DEFAULT_SPEC.name, ...TEMPLATES.map((template) => template.name)]);
/** Names this designer generates, such as "38mm green field watch" or "42mm black PVD sport watch". */
const GENERATED_NAME = /^\d{2}(?:\.\d)?mm(?: [A-Za-z]+)* (?:dive|field|dress|pilot|GMT|sport) watch$/;

/** The colour word that best describes a dial, when one clearly does. */
function dialColorName(hex: string): ColorName | undefined {
  let best: ColorName | undefined;
  let bestMatch = 0;
  for (const color of Object.keys(COLOR_WORDS) as ColorName[]) {
    const match = colorMatch(hex, color);
    if (match > bestMatch) [best, bestMatch] = [color, match];
  }
  return bestMatch >= COLOR_MATCH_THRESHOLD ? best : undefined;
}

function descriptiveName(watchCase: WatchCase, dial: Dial): string {
  const material = materialLabel({ case: watchCase });
  const color = dialColorName(dial.colorHex);
  const words = [
    `${watchCase.diameterMm}mm`,
    color && !material.includes(color) ? color : "",
    material === "steel" ? "" : material,
    STYLE_LABELS[watchCase.style],
    "watch",
  ];
  return words.filter(Boolean).join(" ");
}

/**
 * A new proposal (more than a small edit) gets a descriptive name such as "38mm green field watch",
 * unless the customer named it: a template's name on a field watch would follow it into the order.
 * A name this designer made up is kept up to date with every change.
 */
function proposalName(base: WatchSpec, after: WatchSpec, intent: DesignIntent, catalog: Catalog): string {
  const current = base.name.trim();
  const generated = GENERATED_NAME.test(current);
  if (intent.designName !== undefined || !(generated || GENERIC_NAMES.has(current))) return after.name;
  const swapped = SELECTION_ORDER.filter((slot) => base[slot] !== after[slot]).length;
  const { case: watchCase, dial } = resolveSpec(after, catalog);
  if (!watchCase || !dial || swapped === 0 || (!generated && swapped <= 2)) return after.name;
  return descriptiveName(watchCase, dial);
}

/** Designs a watch from the request without calling any AI. Pure and deterministic. */
export function designOffline(req: DesignRequest, fallback: FallbackReason, catalog: Catalog = CATALOG): DesignDraft {
  const base = req.currentSpec ?? DEFAULT_SPEC;
  const intent = parseIntent(req.message);
  const result = designWithinBudget(base, intent, catalog);
  const named = { ...result, spec: { ...result.spec, name: proposalName(base, result.spec, intent, catalog) } };
  return {
    mode: "offline",
    spec: named.spec,
    reply: composeReply(req, base, intent, named, fallback, catalog),
  };
}
