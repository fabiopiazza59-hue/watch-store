import { EXTRAS, findPart, partsForSlot, SLOTS, specExtras, type DesignTemplate } from "../catalog";
import type { Catalog, Personalization, RepairResult, SlotKey, SuggestedFix, ValidationReport, WatchSpec } from "../types";
import { applyPatch } from "./engine";
import { quote } from "./format";

export const MAX_REPAIR_STEPS = 12;

type Validate = (spec: WatchSpec) => ValidationReport;

function touchesLocked(fix: SuggestedFix, lockedSlots: readonly SlotKey[]): boolean {
  return Object.keys(fix.patch).some((key) => lockedSlots.includes(key as SlotKey));
}

/**
 * Applies the first fix of the first fixable error, over and over, until the spec is buildable, no
 * error has a fix, the step limit is reached, or a fix would lead back to a spec already visited.
 * Fixes that would change a slot in `lockedSlots` are skipped, so with locked slots the loop takes
 * the first fix of any error that leaves them alone. `validate` is injected so the loop can be
 * exercised on its own. `changes` lists every step, in order.
 */
export function repair(
  spec: WatchSpec,
  validate: Validate,
  catalog: Catalog,
  lockedSlots: readonly SlotKey[] = [],
): RepairResult {
  const visited = new Set([specKey(spec)]);
  const changes: string[] = [];
  let current = spec;
  let report = validate(current);

  for (let step = 0; step < MAX_REPAIR_STEPS && !report.buildable; step++) {
    const fix = report.issues
      .filter((issue) => issue.severity === "error")
      .flatMap((issue) => issue.fixes)
      .find((candidate) => !touchesLocked(candidate, lockedSlots));
    if (!fix) break;
    const next = applyPatch(current, fix.patch);
    const key = specKey(next);
    if (visited.has(key)) break;
    visited.add(key);
    changes.push(...describeChanges(current, next, catalog));
    current = next;
    report = validate(current);
  }
  return { spec: current, changes, report };
}

/**
 * The repair loop around parts the customer chose: it never changes a slot in `lockedSlots`.
 * `changes` compares the result with `spec` (one line per slot that ended up different), which is
 * how a picker describes what else a choice would change.
 */
export function repairAround(
  spec: WatchSpec,
  lockedSlots: readonly SlotKey[],
  validate: Validate,
  catalog: Catalog,
): RepairResult {
  const result = repair(spec, validate, catalog, lockedSlots);
  return { ...result, changes: describeChanges(spec, result.spec, catalog) };
}

/**
 * repairAround, and when that isn't enough, two wider searches with the rest repaired around each
 * start: every part for the other slots of the first problem left (every case, for a dial made for
 * another crown position), and every template's parts in the unlocked slots (a GMT movement, dial and
 * case for GMT hands). Of the designs that become buildable, the one with the fewest changes and
 * caveats (warnings) together wins, fewer caveats breaking a tie; when none does, the greedy result.
 */
export function repairKeepingParts(
  spec: WatchSpec,
  lockedSlots: readonly SlotKey[],
  validate: Validate,
  catalog: Catalog,
  templates: readonly DesignTemplate[],
): RepairResult {
  const greedy = repairAround(spec, lockedSlots, validate, catalog);
  const blocker = greedy.report.issues.find((issue) => issue.severity === "error");
  if (!blocker) return greedy;

  const starts: { spec: WatchSpec; locked: readonly SlotKey[] }[] = [];
  for (const slot of blocker.slots.filter((candidate) => !lockedSlots.includes(candidate))) {
    for (const part of partsForSlot(slot, catalog)) {
      if (part.id === greedy.spec[slot]) continue;
      starts.push({ spec: { ...greedy.spec, [slot]: part.id }, locked: [...lockedSlots, slot] });
    }
  }
  const unlocked = SLOTS.filter(({ slot }) => !lockedSlots.includes(slot));
  for (const template of templates) {
    const parts = Object.fromEntries(unlocked.map(({ slot }) => [slot, template.spec[slot]]));
    starts.push({ spec: { ...spec, ...parts }, locked: lockedSlots });
  }

  let best: { result: RepairResult; cost: number; warnings: number } | null = null;
  for (const start of starts) {
    const attempt = repair(start.spec, validate, catalog, start.locked);
    if (!attempt.report.buildable) continue;
    const changes = describeChanges(spec, attempt.spec, catalog);
    const warnings = attempt.report.issues.filter((issue) => issue.severity === "warning").length;
    const cost = changes.length + warnings;
    if (!best || cost < best.cost || (cost === best.cost && warnings < best.warnings)) {
      best = { result: { ...attempt, changes }, cost, warnings };
    }
  }
  return best?.result ?? greedy;
}

function specKey(spec: WatchSpec): string {
  const extras = specExtras(spec);
  return JSON.stringify([
    spec.name,
    ...SLOTS.map(({ slot }) => spec[slot]),
    spec.personalization.dialText,
    spec.personalization.casebackEngraving,
    extras.spareStrapId,
    extras.itemIds,
  ]);
}

const TEXT_FIELDS: [keyof Personalization, string][] = [
  ["dialText", "Dial text"],
  ["casebackEngraving", "Caseback engraving"],
];

function partLabel(id: string | null, catalog: Catalog): string {
  if (!id) return "none";
  return findPart(id, catalog)?.name ?? `unknown part ${quote(id)}`;
}

function textLabel(text: string): string {
  return text.trim() ? quote(text) : "none";
}

function extraLabel(id: string): string {
  return EXTRAS.find((extra) => extra.id === id)?.name ?? `unknown add-on ${quote(id)}`;
}

function count(ids: readonly string[], id: string): number {
  return ids.filter((candidate) => candidate === id).length;
}

/**
 * "Spare strap: none → Olive NATO 20mm", then "Added: Presentation box" and "Removed: Gift wrapping
 * and card" in catalogue order. Absent extras read as none.
 */
function describeExtrasChanges(before: WatchSpec, after: WatchSpec, catalog: Catalog): string[] {
  const [was, now] = [specExtras(before), specExtras(after)];
  const spare =
    was.spareStrapId !== now.spareStrapId
      ? [`Spare strap: ${partLabel(was.spareStrapId, catalog)} → ${partLabel(now.spareStrapId, catalog)}`]
      : [];
  const catalogueOrder = EXTRAS.map((extra) => extra.id);
  const ids = [...new Set([...catalogueOrder, ...was.itemIds, ...now.itemIds])];
  const items = ids.flatMap((id) => {
    const [countBefore, countAfter] = [count(was.itemIds, id), count(now.itemIds, id)];
    if (countBefore === countAfter) return [];
    if (countBefore === 0) return [`Added: ${extraLabel(id)}`];
    if (countAfter === 0) return [`Removed: ${extraLabel(id)}`];
    return [`${countAfter > countBefore ? "Added" : "Removed"}: duplicate ${extraLabel(id)}`];
  });
  return [...spare, ...items];
}

/** Human-readable differences between two specs: "Strap: Black rubber 22mm → Olive NATO 20mm". */
export function describeChanges(before: WatchSpec, after: WatchSpec, catalog: Catalog): string[] {
  const parts = SLOTS.filter(({ slot }) => before[slot] !== after[slot]).map(
    ({ slot, label }) => `${label}: ${partLabel(before[slot], catalog)} → ${partLabel(after[slot], catalog)}`,
  );
  const texts = TEXT_FIELDS.filter(([field]) => before.personalization[field] !== after.personalization[field]).map(
    ([field, label]) =>
      `${label}: ${textLabel(before.personalization[field])} → ${textLabel(after.personalization[field])}`,
  );
  return [...parts, ...texts, ...describeExtrasChanges(before, after, catalog)];
}
