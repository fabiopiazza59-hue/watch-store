// The offline designer: turns a message into a buildable spec with keyword matching and catalogue
// attributes, no AI involved. Used when no API key is configured and whenever the Claude designer
// cannot answer. Deterministic: the same request always gives the same design and reply.
import { CATALOG, DEFAULT_SPEC, findPart, resolveSpec, TEMPLATES } from "../catalog";
import { priceSpec } from "../pricing";
import { repairSpec, validateSpec } from "../rules";
import type { Catalog, DesignRequest, Issue, Part, Personalization, ResolvedSpec, WatchSpec, WatchStyle } from "../types";
import { type ColorName, COLOR_WORDS, colorMatch } from "./colors";
import { parseIntent, type DesignIntent, type UnsupportedFeature } from "./intent";
import { SELECTION_ORDER, selectParts, type Selection, type SlotChoice } from "./select";
import type { DesignDraft, FallbackReason } from "./types";

/** Preference points per euro of part cost: a light tie-break, or a strong pull towards a budget. */
const COST_WEIGHT = 0.005;
const BUDGET_COST_WEIGHT = 0.04;
const LEAN_COST_WEIGHT = 0.2;

/** A blocked favourite is only worth explaining when it was clearly the better match. */
const TRADE_OFF_MARGIN = 2;
const MAX_NOTES = 2;
/** A chosen part "has" a requested colour at or above this match. */
const COLOR_MATCH_THRESHOLD = 0.5;

const FALLBACK_NOTES: Record<FallbackReason, string> = {
  "no-key": "I'm the workshop's offline designer; add an Anthropic API key to chat with the full AI designer.",
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

interface Design {
  spec: WatchSpec;
  selection: Selection;
  rejectedTexts: { text: string; issue: Issue }[];
}

function listJoin(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/)[0];
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
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
function design(base: WatchSpec, intent: DesignIntent, costWeight: number, catalog: Catalog): Design {
  const personalization = requestedPersonalization(base, intent);
  const start = { ...base, name: intent.designName ?? base.name, personalization };
  let selection = selectParts(start, base, intent, costWeight, catalog);

  const report = validateSpec(selection.spec, catalog);
  const rejectedTexts = TEXT_RULES.flatMap(([field, ruleId]) => {
    const text = personalization[field];
    const issue = report.issues.find((i) => i.ruleId === ruleId && i.severity === "error");
    return issue && text !== base.personalization[field] ? [{ field, text, issue }] : [];
  });
  if (rejectedTexts.length > 0) {
    const kept = { ...personalization };
    for (const { field } of rejectedTexts) kept[field] = base.personalization[field];
    selection = selectParts({ ...start, personalization: kept }, base, intent, costWeight, catalog);
  }
  return { spec: repairSpec(selection.spec, catalog).spec, selection, rejectedTexts };
}

function priceOf(spec: WatchSpec, catalog: Catalog): number {
  return priceSpec(spec, catalog).suggestedRetailEur;
}

interface BudgetedDesign extends Design {
  /** Price of the leanest version of the design, when even the budget-minded one costs too much. */
  leanPriceEur?: number;
}

/**
 * With a budget, parts are chosen with cost in mind. When that is still too expensive, a leaner
 * version that trades away preferences is used only if it fits the budget; otherwise the customer
 * gets the design they described, and the reply tells them the leanest price we found.
 */
function designWithinBudget(base: WatchSpec, intent: DesignIntent, catalog: Catalog): BudgetedDesign {
  if (intent.budgetEur === undefined) return design(base, intent, COST_WEIGHT, catalog);
  const preferred = design(base, intent, BUDGET_COST_WEIGHT, catalog);
  if (priceOf(preferred.spec, catalog) <= intent.budgetEur) return preferred;
  const lean = design(base, intent, LEAN_COST_WEIGHT, catalog);
  const leanPriceEur = priceOf(lean.spec, catalog);
  return leanPriceEur <= intent.budgetEur ? lean : { ...preferred, leanPriceEur };
}

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

function describeDesign(parts: ResolvedSpec, intent: DesignIntent): string {
  const { case: watchCase, dial, hands, bezelInsert } = parts;
  if (!watchCase || !dial || !hands) return "Here's a starting point for your design.";
  const style = STYLE_LABELS[intent.style ?? watchCase.style];
  const insert = bezelInsert ? `, a ${bezelInsert.name} insert` : "";
  return (
    `Here's a ${watchCase.diameterMm}mm ${materialLabel(parts)} ${style} watch: the ${watchCase.name} case with the ` +
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

/**
 * The reply's first sentence. When nothing changed, it only claims the design "already fits" the
 * request if no note follows to explain a wish that couldn't be met; otherwise the notes lead.
 */
function opening(
  before: WatchSpec | undefined,
  after: WatchSpec,
  intent: DesignIntent,
  catalog: Catalog,
  explained: boolean,
): string {
  const parts = resolveSpec(after, catalog);
  if (!before) return describeDesign(parts, intent);
  const partsChanged = SELECTION_ORDER.some((slot) => before[slot] !== after[slot]);
  if (partsChanged) return describeEdit(before, after, catalog) ?? describeDesign(parts, intent);
  const textChanged =
    before.personalization.dialText !== after.personalization.dialText ||
    before.personalization.casebackEngraving !== after.personalization.casebackEngraving;
  if (textChanged) return "I've kept every part as it is.";
  // The notes that follow say what couldn't be done and why; they are the answer.
  if (explained) return "";
  return "Your current design already fits that, so I've kept it as it is.";
}

function brandNote(intent: DesignIntent): string | undefined {
  if (intent.brands.length === 0) return undefined;
  const plural = intent.brands.length > 1;
  return (
    `${listJoin(intent.brands)} ${plural ? "are other companies' trademarks" : "is another company's trademark"}, ` +
    `so I can't put ${plural ? "those names" : "that name"} or any logo on your watch, but this design is in the same spirit.`
  );
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

function sizeNote(intent: DesignIntent, catalog: Catalog): string | undefined {
  if (intent.size?.kind !== "target") return undefined;
  const diameters = catalog.cases.map((c) => c.diameterMm);
  const [smallest, largest] = [Math.min(...diameters), Math.max(...diameters)];
  if (intent.size.mm < smallest) return `Our cases run from ${smallest} to ${largest}mm, so ${smallest}mm is as compact as I can go.`;
  if (intent.size.mm > largest) return `Our cases run from ${smallest} to ${largest}mm, so ${largest}mm is as big as I can go.`;
  return undefined;
}

/**
 * Explains the most telling part the rules ruled out: one the customer's wishes pointed to, or the
 * current part when its own constraints (not the other new parts) rule it out.
 */
function tradeOffNote(choices: SlotChoice[], base: WatchSpec): string | undefined {
  for (const { slot, chosen, ranked } of choices) {
    const [favourite] = ranked;
    if (!favourite.blocker || !favourite.part || !chosen.part) continue;
    const ownConstraint = favourite.blocker.slots.every((s) => s === slot);
    const wished = favourite.partId !== base[slot] && favourite.score - chosen.score >= TRADE_OFF_MARGIN;
    if (wished || ownConstraint) return blockedNote(favourite.blocker, chosen.part, chosen.partId === base[slot]);
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
  const [wanted] = intent.colors.dial.filter((color) => color !== "gold");
  const dialChoice = choices.find(({ slot }) => slot === "dialId");
  const dial = dialChoice?.chosen.part;
  if (!wanted || !dialChoice || !dial || dial.category !== "dial") return undefined;
  if (colorMatch(dial.colorHex, wanted) >= COLOR_MATCH_THRESHOLD) return undefined;
  if (!catalog.dials.some((d) => colorMatch(d.colorHex, wanted) >= COLOR_MATCH_THRESHOLD)) {
    return `There's no ${wanted} dial in the parts library yet, so I went with the ${dial.name} dial.`;
  }
  const blocked = dialChoice.ranked.find(
    ({ part, blocker }) => blocker && part?.category === "dial" && colorMatch(part.colorHex, wanted) >= COLOR_MATCH_THRESHOLD,
  );
  const keptCurrent = dialChoice.chosen.partId === base.dialId;
  if (blocked?.blocker) return blockedNote(blocked.blocker, dial, keptCurrent);
  return keptCurrent
    ? `None of the ${wanted} dials fit this case, so I've kept the ${dial.name} dial.`
    : `None of the ${wanted} dials fit this case, so I went with the ${dial.name} dial.`;
}

function strapNote(intent: DesignIntent, parts: ResolvedSpec): string | undefined {
  const strap = parts.strap;
  if (!intent.strapType || !strap || strap.type === intent.strapType || !parts.case) return undefined;
  return `There's no ${intent.strapType} strap for the ${parts.case.lugWidthMm}mm lugs of this case, so it's on the ${strap.name} instead.`;
}

function budgetNote(intent: DesignIntent, result: BudgetedDesign, catalog: Catalog): string | undefined {
  if (intent.budgetEur === undefined) return undefined;
  const price = Math.round(priceOf(result.spec, catalog));
  if (price <= intent.budgetEur) return `It comes to about €${price}, within your €${intent.budgetEur} budget.`;
  const lean = result.leanPriceEur !== undefined && result.leanPriceEur < price ? Math.round(result.leanPriceEur) : undefined;
  return lean
    ? `It comes to about €${price}, over your €${intent.budgetEur} budget; the leanest version I could put together is about €${lean}.`
    : `It comes to about €${price}, over your €${intent.budgetEur} budget even with the more affordable parts.`;
}

function composeReply(
  before: WatchSpec | undefined,
  base: WatchSpec,
  intent: DesignIntent,
  result: BudgetedDesign,
  fallback: FallbackReason,
  catalog: Catalog,
): string {
  const parts = resolveSpec(result.spec, catalog);
  const notes = [
    brandNote(intent),
    intent.swiss ? SWISS_NOTE : undefined,
    ...intent.unsupported.slice(0, 1).map((feature) => UNSUPPORTED_NOTES[feature]),
    sizeNote(intent, catalog),
    ...textNotes(base.personalization, result.spec.personalization, result.rejectedTexts),
    budgetNote(intent, result, catalog),
    tradeOffNote(result.selection.choices, base),
    colorNote(intent, result.selection.choices, base, catalog),
    strapNote(intent, parts),
  ].filter((note): note is string => Boolean(note));

  const report = validateSpec(result.spec, catalog);
  const warning = report.issues.find((issue) => issue.severity === "warning");
  const status = report.buildable
    ? warning && `One thing to know: ${lowerFirst(warning.message)}`
    : "I couldn't make every part fit yet; the build check shows what still needs sorting.";

  const shown = notes.slice(0, MAX_NOTES);
  return [opening(before, result.spec, intent, catalog, shown.length > 0), ...shown, status, FALLBACK_NOTES[fallback]]
    .filter(Boolean)
    .join(" ");
}

/** Names nobody chose: blank, the default design's, or a starting template's. */
const GENERIC_NAMES = new Set(["", DEFAULT_SPEC.name, ...TEMPLATES.map((template) => template.name)]);

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

/**
 * A new proposal (more than a small edit) gets a descriptive name such as "38mm green field watch",
 * unless the customer named it: a template's name on a field watch would follow it into the order.
 */
function proposalName(base: WatchSpec, after: WatchSpec, intent: DesignIntent, catalog: Catalog): string {
  if (intent.designName !== undefined || !GENERIC_NAMES.has(base.name.trim())) return after.name;
  const swapped = SELECTION_ORDER.filter((slot) => base[slot] !== after[slot]).length;
  const { case: watchCase, dial } = resolveSpec(after, catalog);
  if (swapped <= 2 || !watchCase || !dial) return after.name;
  const material = materialLabel({ case: watchCase });
  const color = dialColorName(dial.colorHex);
  const words = [
    `${watchCase.diameterMm}mm`,
    color && !material.includes(color) ? color : "",
    material === "steel" ? "" : material,
    STYLE_LABELS[intent.style ?? watchCase.style],
    "watch",
  ];
  return words.filter(Boolean).join(" ");
}

/** Designs a watch from the request without calling any AI. Pure and deterministic. */
export function designOffline(req: DesignRequest, fallback: FallbackReason, catalog: Catalog = CATALOG): DesignDraft {
  const base = req.currentSpec ?? DEFAULT_SPEC;
  const intent = parseIntent(req.message);
  const result = designWithinBudget(base, intent, catalog);
  return {
    mode: "offline",
    spec: { ...result.spec, name: proposalName(base, result.spec, intent, catalog) },
    reply: composeReply(req.currentSpec, base, intent, result, fallback, catalog),
  };
}
