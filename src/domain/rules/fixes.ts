import { findPart, partsForSlot, specExtras } from "../catalog";
import type { Catalog, Part, PartCategory, SlotKey, Strap, SuggestedFix, WatchSpec } from "../types";
import { EXTRAS_RULE_IDS } from "./checks/extras";
import { applyPatch, collectFindings } from "./engine";
import { PART_NOUN, quote } from "./format";
import type { Finding } from "./model";

const MAX_FIXES = 3;

/**
 * Up to three fixes for `target`, each verified by re-validating the patched spec: a fix must make
 * this problem go away without introducing an error the spec didn't already have (nor, when fixing a
 * warning, a new warning: trading one caveat for another is no fix).
 *
 * Part swaps are ranked by similarity to the current part, then price, then catalogue order. The
 * preferred slot fills up to two places and every other slot one, so the customer also sees an
 * alternative for the bigger part ("or a case that takes this dial"); places left over go back to
 * the slots in order of preference. Patches (clearing a text, removing an insert) always keep their
 * place, and so do spare-strap swaps: a spare-strap problem gets up to three other straps plus
 * "Remove the spare strap".
 *
 * The extras follow the watch: a fix to the watch itself may leave the spare strap not fitting (a case
 * with other lugs), and is still offered. The spare strap's own fixes then sort it out, which is what
 * the repair loop does next.
 */
export function suggestFixes(target: Finding, spec: WatchSpec, findings: Finding[], catalog: Catalog): SuggestedFix[] {
  if (target.remedies.length === 0) return [];
  const aboutExtras = (f: Finding) => EXTRAS_RULE_IDS.has(f.ruleId);
  const mustNotBeNew = (f: Finding) =>
    (f.severity === "error" || (target.severity === "warning" && f.severity === "warning")) &&
    (aboutExtras(target) || !aboutExtras(f));
  const existing = new Set(findings.filter(mustNotBeNew).map((f) => f.key));
  const resolves = (patch: Partial<WatchSpec>): boolean =>
    collectFindings(applyPatch(spec, patch), catalog).every(
      (f) => f.key !== target.key && (!mustNotBeNew(f) || existing.has(f.key)),
    );

  const groups = target.remedies.map((remedy): FixGroup => {
    if ("patch" in remedy) return { shared: false, fixes: resolves(remedy.patch.patch) ? [remedy.patch] : [] };
    if ("swap" in remedy) return { shared: true, fixes: swapFixes(remedy.swap, spec, catalog, resolves) };
    return { shared: false, fixes: spareStrapFixes(spec, catalog, resolves) };
  });
  return allocate(groups);
}

interface FixGroup {
  /** Part swaps share the MAX_FIXES places; other groups keep all their fixes. */
  shared: boolean;
  fixes: SuggestedFix[];
}

function allocate(groups: FixGroup[]): SuggestedFix[] {
  const taken = groups.map((group) => (group.shared ? 0 : group.fixes.length));
  let budget = Math.max(0, MAX_FIXES - taken.reduce((sum, n) => sum + n, 0));
  const sharedGroups = groups.flatMap((group, index) => (group.shared ? [index] : []));
  sharedGroups.forEach((index, preference) => {
    const share = Math.min(preference === 0 ? 2 : 1, groups[index].fixes.length, budget);
    taken[index] = share;
    budget -= share;
  });
  for (const index of sharedGroups) {
    const extra = Math.min(groups[index].fixes.length - taken[index], budget);
    taken[index] += extra;
    budget -= extra;
  }
  return groups.flatMap((group, index) => group.fixes.slice(0, taken[index]));
}

function swapFixes(
  slot: SlotKey,
  spec: WatchSpec,
  catalog: Catalog,
  resolves: (patch: Partial<WatchSpec>) => boolean,
): SuggestedFix[] {
  const currentId = spec[slot];
  const current = findPart(currentId, catalog);
  const ranked = partsForSlot(slot, catalog)
    .filter((part) => part.id !== currentId)
    .map((part, order) => ({ part, order, score: current ? similarity(part, current) : 0 }))
    .sort((a, b) => b.score - a.score || a.part.costEur - b.part.costEur || a.order - b.order);

  const verb = currentId ? "Use" : "Add";
  const fixes: SuggestedFix[] = [];
  for (const { part } of ranked) {
    if (fixes.length === MAX_FIXES) break;
    const patch: Partial<WatchSpec> = {};
    patch[slot] = part.id;
    if (resolves(patch)) {
      fixes.push({ description: `${verb} the ${quote(part.name)} ${PART_NOUN[part.category]}`, patch });
    }
  }
  return fixes;
}

/** How much a spare strap of another type than the main strap is preferred: a spare is usually for variety. */
const SPARE_VARIETY_BONUS = 4;

/**
 * Up to three other straps for the spare, each verified like any fix. A different type from the main
 * strap comes first, then the closest to the spare chosen, then the cheaper. The main strap itself is
 * never offered: that would be two identical straps.
 */
function spareStrapFixes(
  spec: WatchSpec,
  catalog: Catalog,
  resolves: (patch: Partial<WatchSpec>) => boolean,
): SuggestedFix[] {
  const extras = specExtras(spec);
  const main = catalog.straps.find((strap) => strap.id === spec.strapId);
  const current = catalog.straps.find((strap) => strap.id === extras.spareStrapId);
  const score = (strap: Strap) =>
    (main && strap.type !== main.type ? SPARE_VARIETY_BONUS : 0) + (current ? similarity(strap, current) : 0);
  const ranked = catalog.straps
    .filter((strap) => strap.id !== extras.spareStrapId && strap.id !== spec.strapId)
    .map((strap, order) => ({ strap, order, score: score(strap) }))
    .sort((a, b) => b.score - a.score || a.strap.costEur - b.strap.costEur || a.order - b.order);

  const fixes: SuggestedFix[] = [];
  for (const { strap } of ranked) {
    if (fixes.length === MAX_FIXES) break;
    const patch: Partial<WatchSpec> = { extras: { spareStrapId: strap.id, itemIds: [...extras.itemIds] } };
    if (resolves(patch)) fixes.push({ description: `Use the ${quote(strap.name)} strap as the spare`, patch });
  }
  return fixes;
}

// ---------------------------------------------------------------------------
// Similarity: same style / type / material first, then close colours.
// ---------------------------------------------------------------------------

type PartOf<C extends PartCategory> = Extract<Part, { category: C }>;
type Scorer<P> = (candidate: P, current: P) => number;

const same = (a: unknown, b: unknown): number => (a === b ? 1 : 0);

function rgb(hex: string): [number, number, number] | undefined {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d).join("") : match[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

/** 1 for identical colours, 0 for black against white. */
function colourCloseness(a: string, b: string): number {
  const [x, y] = [rgb(a), rgb(b)];
  if (!x || !y) return 0;
  const distance = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  return 1 - distance / Math.hypot(255, 255, 255);
}

const SIMILARITY: { [C in PartCategory]: Scorer<PartOf<C>> } = {
  movement: (a, b) =>
    same([...a.complications].sort().join(), [...b.complications].sort().join()) * 3 +
    same(a.dateDisplay, b.dateDisplay) * 2 +
    same(a.maker, b.maker),
  case: (a, b) =>
    same(a.style, b.style) * 3 +
    same(a.material, b.material) * 2 +
    same(a.finish, b.finish) +
    Math.max(0, 1 - Math.abs(a.diameterMm - b.diameterMm) / 6),
  dial: (a, b) =>
    same(a.style, b.style) * 3 +
    colourCloseness(a.colorHex, b.colorHex) * 2 +
    same(a.dateWindow, b.dateWindow) +
    same(a.texture, b.texture) +
    same(a.indices, b.indices) +
    same(a.lume, b.lume) * 0.5,
  hands: (a, b) =>
    same(a.style, b.style) * 3 +
    colourCloseness(a.colorHex, b.colorHex) * 2 +
    same(a.lume, b.lume) +
    same(a.includesGmt, b.includesGmt),
  crystal: (a, b) => same(a.material, b.material) * 3 + same(a.shape, b.shape) * 2 + same(a.arCoating, b.arCoating),
  bezelInsert: (a, b) =>
    same(a.scale, b.scale) * 3 +
    colourCloseness(a.colorHex, b.colorHex) * 2 +
    same(a.material, b.material) +
    same(a.lumePip, b.lumePip) * 0.5,
  strap: (a, b) => same(a.type, b.type) * 3 + colourCloseness(a.colorHex, b.colorHex) * 2,
};

function similarity(candidate: Part, current: Part): number {
  if (candidate.category !== current.category) return 0;
  const score = SIMILARITY[candidate.category] as Scorer<Part>;
  return score(candidate, current);
}
