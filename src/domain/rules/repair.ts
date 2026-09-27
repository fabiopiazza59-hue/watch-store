import { findPart, SLOTS } from "../catalog";
import type { Catalog, Personalization, RepairResult, ValidationReport, WatchSpec } from "../types";
import { applyPatch } from "./engine";
import { quote } from "./format";

export const MAX_REPAIR_STEPS = 12;

/**
 * Applies the first fix of the first fixable error, over and over, until the spec is buildable, no
 * error has a fix, the step limit is reached, or a fix would lead back to a spec already visited.
 * `validate` is injected so the loop can be exercised on its own.
 */
export function repair(
  spec: WatchSpec,
  validate: (spec: WatchSpec) => ValidationReport,
  catalog: Catalog,
): RepairResult {
  const visited = new Set([specKey(spec)]);
  const changes: string[] = [];
  let current = spec;
  let report = validate(current);

  for (let step = 0; step < MAX_REPAIR_STEPS && !report.buildable; step++) {
    const fix = report.issues.find((issue) => issue.severity === "error" && issue.fixes.length > 0)?.fixes[0];
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

function specKey(spec: WatchSpec): string {
  return JSON.stringify([
    spec.name,
    ...SLOTS.map(({ slot }) => spec[slot]),
    spec.personalization.dialText,
    spec.personalization.casebackEngraving,
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

/** Human-readable differences between two specs: "Strap: Black rubber 22mm → Olive NATO 20mm". */
export function describeChanges(before: WatchSpec, after: WatchSpec, catalog: Catalog): string[] {
  const parts = SLOTS.filter(({ slot }) => before[slot] !== after[slot]).map(
    ({ slot, label }) => `${label}: ${partLabel(before[slot], catalog)} → ${partLabel(after[slot], catalog)}`,
  );
  const texts = TEXT_FIELDS.filter(([field]) => before.personalization[field] !== after.personalization[field]).map(
    ([field, label]) =>
      `${label}: ${textLabel(before.personalization[field])} → ${textLabel(after.personalization[field])}`,
  );
  return [...parts, ...texts];
}
