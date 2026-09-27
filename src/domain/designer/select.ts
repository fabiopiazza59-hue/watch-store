// Offline part selection: fills each slot, in dependency order, with the compatible part whose
// catalogue attributes best match the customer's intent. Compatibility always comes from the rules
// engine (`evaluateOptions`); this module only expresses taste.
import { CATALOG, NONE_OPTION_ID, findPart, resolveSpec } from "../catalog";
import { evaluateOptions } from "../rules";
import type {
  BezelInsert,
  Catalog,
  Crystal,
  Dial,
  HandSet,
  HandStyle,
  Issue,
  Movement,
  Part,
  ResolvedSpec,
  SlotKey,
  Strap,
  WatchCase,
  WatchSpec,
  WatchStyle,
} from "../types";
import { colorMatch, colorSimilarity, lightness, type ColorName } from "./colors";
import type { DesignIntent } from "./intent";

/** Each slot is chosen knowing the slots before it: the case sets dial size and lug width, and so on. */
export const SELECTION_ORDER: SlotKey[] = [
  "caseId",
  "movementId",
  "dialId",
  "handsId",
  "bezelInsertId",
  "crystalId",
  "strapId",
];

/**
 * Score bonus for keeping the part already in the design, so edits stay small. Hands and crystals
 * follow the dial and case, so holding on to them matters less.
 */
const KEEP_BONUS: Record<SlotKey, number> = {
  caseId: 2,
  movementId: 2,
  dialId: 2,
  handsId: 1,
  bezelInsertId: 2,
  crystalId: 1,
  strapId: 2,
};
const WARNING_PENALTY = 1.5;
/** How much the best reachable dial and strap count towards a case's score. */
const DIAL_LOOKAHEAD_WEIGHT = 0.6;
const STRAP_LOOKAHEAD_WEIGHT = 0.3;

const RELATED_STYLES: Record<WatchStyle, WatchStyle[]> = {
  diver: ["gmt", "sport"],
  gmt: ["diver", "sport"],
  sport: ["diver", "gmt"],
  field: ["pilot"],
  pilot: ["field"],
  dress: [],
};

const HAND_STYLES_BY_WATCH_STYLE: Record<WatchStyle, HandStyle[]> = {
  diver: ["mercedes", "sword", "snowflake"],
  gmt: ["mercedes", "arrow", "sword"],
  sport: ["baton", "sword", "arrow"],
  field: ["sword", "syringe", "cathedral"],
  pilot: ["syringe", "sword", "arrow"],
  dress: ["dauphine", "baton", "cathedral"],
};

/** Leather colour that suits each style when the customer names none. */
const LEATHER_COLOR_BY_STYLE: Record<WatchStyle, ColorName> = {
  diver: "brown",
  gmt: "brown",
  sport: "black",
  field: "brown",
  pilot: "brown",
  dress: "black",
};

const STRAP_TYPES_BY_WATCH_STYLE: Record<WatchStyle, Partial<Record<Strap["type"], number>>> = {
  diver: { rubber: 2, bracelet: 1.5, nato: 1 },
  gmt: { bracelet: 2.5, rubber: 1 },
  sport: { rubber: 2.5, bracelet: 1 },
  field: { canvas: 2, nato: 2, leather: 1.5 },
  pilot: { leather: 2.5, nato: 1 },
  dress: { leather: 3 },
};

interface ScoringContext {
  intent: DesignIntent;
  /** The style to design towards: what the customer asked for, else the chosen case's style. */
  style?: WatchStyle;
  /** The design as chosen so far. */
  parts: ResolvedSpec;
  /** Id of the part this slot held before, if any, and how much keeping it is worth. */
  keepId: string | null;
  keepBonus: number;
  /** Preference points each euro of part cost takes away. */
  costWeight: number;
  catalog: Catalog;
}

export interface Candidate {
  partId: string | null;
  part?: Part;
  /** The error that rules this part out, given the slots already chosen. */
  blocker?: Issue;
  score: number;
}

export interface SlotChoice {
  slot: SlotKey;
  chosen: Candidate;
  /** Every option for the slot, best first, including the ones the rules ruled out. */
  ranked: Candidate[];
}

export interface Selection {
  spec: WatchSpec;
  choices: SlotChoice[];
}

function withPart(spec: WatchSpec, slot: SlotKey, partId: string | null): WatchSpec {
  return slot === "bezelInsertId" ? { ...spec, bezelInsertId: partId } : { ...spec, [slot]: partId ?? "" };
}

function styleAffinity(actual: WatchStyle, wanted: WatchStyle | undefined): number {
  if (!wanted) return 0;
  if (actual === wanted) return 1;
  return RELATED_STYLES[wanted].includes(actual) ? 0.4 : 0;
}

function bestMatch(hex: string, colors: ColorName[]): number {
  return colors.length > 0 ? Math.max(...colors.map((color) => colorMatch(hex, color))) : 0;
}

function wantsGold(intent: DesignIntent): boolean {
  return Object.values(intent.colors).some((colors) => colors.includes("gold"));
}

function scoreCase(watchCase: WatchCase, { intent }: ScoringContext): number {
  let score = 4 * styleAffinity(watchCase.style, intent.style);
  if (intent.material && watchCase.material === intent.material) score += 12;
  if (intent.blackCase && watchCase.finish === "PVD black") score += 6;
  if (intent.displayCaseback && watchCase.caseback === "display") score += 4;
  if (intent.slim) score += 1.5 * (13.5 - watchCase.thicknessMm);
  const size = intent.size;
  if (size?.kind === "target") score -= 1.2 * Math.abs(watchCase.diameterMm - size.mm);
  if (size?.kind === "small") score += 0.8 * (42 - watchCase.diameterMm);
  if (size?.kind === "large") score += 0.8 * (watchCase.diameterMm - 38);
  if (intent.style === "dress") {
    // Dress watches read best small, slim, shiny and without a tool bezel.
    score += 0.5 * (42 - watchCase.diameterMm) + 0.5 * (13.5 - watchCase.thicknessMm);
    if (watchCase.finish.includes("polished")) score += 1;
    if (watchCase.bezel === "none" || watchCase.bezel === "fixed") score += 1;
  }
  return score;
}

function scoreMovement(movement: Movement, { intent, style }: ScoringContext): number {
  const hasGmt = movement.complications.includes("gmt");
  let score = 0;
  if (intent.gmt || style === "gmt") score += hasGmt ? 6 : 0;
  else if (hasGmt) score -= 4;
  if (intent.date) score += movement.dateDisplay === intent.date ? 4 : 0;
  else if (movement.dateDisplay === "date-3") score += 1;
  return score;
}

function scoreDial(dial: Dial, { intent, style }: ScoringContext): number {
  let score = 3 * styleAffinity(dial.style, style);
  intent.colors.dial.forEach((color, i) => {
    const onBase = colorMatch(dial.colorHex, color);
    const onPrint = colorMatch(dial.printColorHex, color);
    const match = color === "gold" ? Math.max(onBase, onPrint) : Math.max(onBase, 0.5 * onPrint);
    score += (i === 0 ? 6 : 2) * match;
  });
  if (intent.date && dial.dateWindow === intent.date) score += 3;
  if ((intent.gmt || style === "gmt") && dial.has24hScale) score += 2;
  if (intent.lume && dial.lume !== "none") score += 1.5;
  if (intent.vintage && (dial.lume === "vintage" || dial.texture === "gloss")) score += 1.5;
  if (intent.indices && dial.indices === intent.indices) score += 2.5;
  if (intent.sunburst && dial.texture === "sunburst") score += 2;
  return score;
}

function scoreHands(hands: HandSet, { intent, style, parts }: ScoringContext): number {
  const preferred = style ? HAND_STYLES_BY_WATCH_STYLE[style] : [];
  const rank = preferred.indexOf(hands.style);
  let score = rank >= 0 ? 3 - rank : 0;
  if (parts.dial) {
    score += 2.5 * Math.abs(lightness(hands.colorHex) - lightness(parts.dial.colorHex));
    if (hands.lume === parts.dial.lume) score += 1.5;
  }
  if (wantsGold(intent)) score += 4 * colorMatch(hands.colorHex, "gold");
  score += 4 * bestMatch(hands.colorHex, intent.colors.hands);
  if (intent.lume && hands.lume === "none") score -= 2;
  if (intent.vintage && hands.lume === "vintage") score += 1.5;
  return score;
}

function scoreInsert(insert: BezelInsert, { intent, style, parts }: ScoringContext): number {
  const [first, second] = intent.colors.bezel;
  const secondary = insert.secondaryColorHex ?? insert.colorHex;
  let score = 0;
  if (first && second) {
    const inOrder = colorMatch(insert.colorHex, first) + colorMatch(secondary, second);
    const swapped = colorMatch(insert.colorHex, second) + colorMatch(secondary, first);
    score += 3 * Math.max(inOrder, swapped);
  } else if (first) {
    score += 5 * Math.max(colorMatch(insert.colorHex, first), 0.6 * colorMatch(secondary, first));
  } else if (parts.dial) {
    score += 2 * colorSimilarity(insert.colorHex, parts.dial.colorHex);
  }
  if ((intent.gmt || style === "gmt") && insert.scale === "gmt-24") score += 3;
  if (style === "diver" && insert.scale === "dive-60") score += 2;
  if (intent.countdown && insert.scale === "countdown-60") score += 5;
  if (intent.unsupported.includes("chronograph") && insert.scale === "countdown-60") score += 3;
  if (intent.ceramic && insert.material === "ceramic") score += 3;
  if (wantsGold(intent)) score += 2 * colorMatch(insert.printColorHex, "gold");
  return score;
}

function scoreCrystal(crystal: Crystal, { intent, style }: ScoringContext): number {
  // Sapphire unless the customer asks for mineral; a dome for dress and vintage looks, else flat.
  let score = crystal.material === (intent.mineral ? "mineral" : "sapphire") ? 3 : 0;
  if (style === "dress") score += crystal.shape === "double-dome" ? 1.5 : 0;
  else if (intent.vintage) score += crystal.shape === "flat" ? 0 : 1.5;
  else score += crystal.shape === "flat" ? 1 : 0;
  return score;
}

function scoreStrap(strap: Strap, { intent, style, parts }: ScoringContext): number {
  let score = intent.strapType === strap.type ? 6 : 0;
  score += style ? (STRAP_TYPES_BY_WATCH_STYLE[style][strap.type] ?? 0) : 0;
  if (intent.colors.strap.length > 0) score += 4 * bestMatch(strap.colorHex, intent.colors.strap);
  else if (strap.type === "leather" && style) score += colorMatch(strap.colorHex, LEATHER_COLOR_BY_STYLE[style]);
  else if (parts.dial && (strap.type === "rubber" || strap.type === "nato")) {
    score += colorSimilarity(strap.colorHex, parts.dial.colorHex);
  }
  return score;
}

/** How well a part matches the intent, before compatibility, cost and keep bonuses. */
function preferenceScore(part: Part, ctx: ScoringContext): number {
  switch (part.category) {
    case "case":
      return scoreCase(part, ctx);
    case "movement":
      return scoreMovement(part, ctx);
    case "dial":
      return scoreDial(part, ctx);
    case "hands":
      return scoreHands(part, ctx);
    case "bezelInsert":
      return scoreInsert(part, ctx);
    case "crystal":
      return scoreCrystal(part, ctx);
    case "strap":
      return scoreStrap(part, ctx);
  }
}

/**
 * Candidates for a slot, scored, with each one's blocking error if any. Only issues among the slot
 * itself and slots already decided count: later slots will be re-chosen to fit.
 */
function rankSlot(
  slot: SlotKey,
  spec: WatchSpec,
  decided: ReadonlySet<SlotKey>,
  ctx: ScoringContext,
  lookahead?: (spec: WatchSpec) => number,
): Candidate[] {
  const candidates = evaluateOptions(slot, spec, ctx.catalog).map((option): Candidate => {
    const partId = option.partId === NONE_OPTION_ID ? null : option.partId;
    const part = findPart(partId, ctx.catalog);
    const relevant = option.issues.filter((issue) => issue.slots.every((s) => s === slot || decided.has(s)));
    const warnings = relevant.filter((issue) => issue.severity === "warning").length;
    let score = (part ? preferenceScore(part, ctx) - part.costEur * ctx.costWeight : 0) - WARNING_PENALTY * warnings;
    if (partId === ctx.keepId) score += ctx.keepBonus;
    if (lookahead) score += lookahead(withPart(spec, slot, partId));
    // The error involving the fewest slots is the part's own limitation ("can't take printing"),
    // which explains a rejection better than a clash with another part.
    const [blocker] = relevant
      .filter((issue) => issue.severity === "error")
      .sort((a, b) => a.slots.length - b.slots.length);
    return { partId, part, blocker, score };
  });
  // Array sort is stable, so equal scores keep catalogue order: deterministic tie-breaks.
  return candidates.sort((a, b) => b.score - a.score);
}

function bestCompatibleScore(slot: SlotKey, spec: WatchSpec, ctx: ScoringContext): number {
  const decided = new Set<SlotKey>(["caseId"]);
  const best = rankSlot(slot, spec, decided, ctx).find((candidate) => !candidate.blocker);
  return best?.score ?? 0;
}

/**
 * The case decides which dials and straps can fit, so a case is worth the best dial and strap it
 * allows. Keeping the current dial or strap earns nothing here: the case's own keep bonus covers it.
 */
function caseLookahead(ctx: ScoringContext): (spec: WatchSpec) => number {
  return (spec) => {
    const parts = resolveSpec(spec, ctx.catalog);
    const lookaheadCtx = { ...ctx, style: ctx.intent.style ?? parts.case?.style, parts, keepId: null, keepBonus: 0 };
    return (
      DIAL_LOOKAHEAD_WEIGHT * bestCompatibleScore("dialId", spec, lookaheadCtx) +
      STRAP_LOOKAHEAD_WEIGHT * bestCompatibleScore("strapId", spec, lookaheadCtx)
    );
  };
}

/**
 * Chooses every slot in SELECTION_ORDER for `start` (a spec whose personalization is already set,
 * since text needs a printable dial or a solid caseback). `base` supplies the parts to keep.
 */
export function selectParts(
  start: WatchSpec,
  base: WatchSpec,
  intent: DesignIntent,
  costWeight: number,
  catalog: Catalog = CATALOG,
): Selection {
  let spec = start;
  const decided = new Set<SlotKey>();
  const choices: SlotChoice[] = [];
  for (const slot of SELECTION_ORDER) {
    const parts = resolveSpec(spec, catalog);
    const ctx: ScoringContext = {
      intent,
      style: intent.style ?? parts.case?.style,
      parts,
      keepId: base[slot],
      keepBonus: KEEP_BONUS[slot],
      costWeight,
      catalog,
    };
    const ranked = rankSlot(slot, spec, decided, ctx, slot === "caseId" ? caseLookahead(ctx) : undefined);
    const chosen = ranked.find((candidate) => !candidate.blocker) ?? ranked[0];
    choices.push({ slot, chosen, ranked });
    spec = withPart(spec, slot, chosen.partId);
    decided.add(slot);
  }
  return { spec, choices };
}
