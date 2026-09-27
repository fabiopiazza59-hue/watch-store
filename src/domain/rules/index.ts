// The single source of truth for "can this watch be built?". Rules are listed in
// docs/feasibility-rules.md and implemented in ./checks; everything here is pure and deterministic.
import { CATALOG, getSlotDef, NONE_OPTION_ID, partsForSlot, resolveSpec, specExtras, TEMPLATES } from "../catalog";
import type { Catalog, OptionStatus, RepairResult, SlotKey, ValidationReport, WatchSpec } from "../types";
import { spareStrap } from "./checks/extras";
import { collectFindings, toIssue, withPart } from "./engine";
import { suggestFixes } from "./fixes";
import { repair, repairAround as repairAroundLoop, repairKeepingParts } from "./repair";

export { describeChanges } from "./repair";

/**
 * The brand and Swiss-indication check behind the dial-text and engraving rules, for free text, and the
 * clean-up (typographic apostrophes and dashes to ASCII) to apply wherever customer text enters a spec.
 */
export { normalizePersonalization, normalizePersonalizationText, reviewText, type TextReview } from "./text";

/** Validate a full spec against every compatibility rule. Deterministic, pure. */
export function validateSpec(spec: WatchSpec, catalog: Catalog = CATALOG): ValidationReport {
  const findings = collectFindings(spec, catalog);
  const issues = findings.map((f) => toIssue(f, suggestFixes(f, spec, findings, catalog)));
  return { buildable: !issues.some((issue) => issue.severity === "error"), issues };
}

/**
 * For each candidate part of `slot` (catalogue order), report whether swapping it into `spec` is
 * compatible. Optional slots start with a NONE_OPTION_ID option meaning "no part".
 * Option issues are errors and warnings only, without fixes: they describe a hypothetical choice,
 * and skipping the fix search keeps a whole picker's worth of validations fast.
 */
export function evaluateOptions(slot: SlotKey, spec: WatchSpec, catalog: Catalog = CATALOG): OptionStatus[] {
  const options = [
    ...(getSlotDef(slot).optional ? [{ partId: NONE_OPTION_ID, value: null }] : []),
    ...partsForSlot(slot, catalog).map((part) => ({ partId: part.id, value: part.id })),
  ];
  return options.map(({ partId, value }) => {
    const issues = collectFindings(withPart(spec, slot, value), catalog)
      .filter((f) => f.severity !== "info" && f.slots.includes(slot))
      .map((f) => toIssue(f, []));
    return { partId, compatible: !issues.some((issue) => issue.severity === "error"), issues };
  });
}

/** Greedily apply suggested fixes until the spec is buildable or no fix makes progress. */
export function repairSpec(spec: WatchSpec, catalog: Catalog = CATALOG): RepairResult {
  return repair(spec, (candidate) => validateSpec(candidate, catalog), catalog);
}

/**
 * repairSpec that never changes the slots in `lockedSlots` (the parts a customer chose), taking the
 * first fix of any error that leaves them alone. `changes` compares the result with `spec`.
 */
export function repairAround(spec: WatchSpec, lockedSlots: readonly SlotKey[], catalog: Catalog = CATALOG): RepairResult {
  return repairAroundLoop(spec, lockedSlots, (candidate) => validateSpec(candidate, catalog), catalog);
}

/**
 * The repair behind "keep the part I chose": repairAround first, then, if the design still can't be
 * built, a wider search (every part for the other slots of the remaining problem, and every
 * template's parts in the unlocked slots) that keeps the buildable result with the fewest changes
 * plus warnings. Returns the greedy result when nothing fits around the locked parts.
 */
export function repairKeeping(spec: WatchSpec, lockedSlots: readonly SlotKey[], catalog: Catalog = CATALOG): RepairResult {
  const templates = catalog === CATALOG ? TEMPLATES : [];
  return repairKeepingParts(spec, lockedSlots, (candidate) => validateSpec(candidate, catalog), catalog, templates);
}

/**
 * For each strap in the catalogue (catalogue order), whether it can be the spare strap for `spec`: the
 * same `OptionStatus` shape as evaluateOptions, with the `spare-strap` errors and warnings choosing it
 * would cause (without fixes). The first option is NONE_OPTION_ID, meaning no spare strap. The info
 * that a strap is the same as the main one is left out: compare `partId` with `spec.strapId` for that.
 */
export function evaluateSpareStraps(spec: WatchSpec, catalog: Catalog = CATALOG): OptionStatus[] {
  const parts = resolveSpec(spec, catalog);
  const { itemIds } = specExtras(spec);
  const options = [{ partId: NONE_OPTION_ID, value: null }, ...catalog.straps.map((strap) => ({ partId: strap.id, value: strap.id }))];
  return options.map(({ partId, value }) => {
    const candidate: WatchSpec = { ...spec, extras: { spareStrapId: value, itemIds } };
    const issues = spareStrap({ spec: candidate, parts, catalog })
      .filter((f) => f.severity !== "info")
      .map((f) => toIssue(f, []));
    return { partId, compatible: !issues.some((issue) => issue.severity === "error"), issues };
  });
}
