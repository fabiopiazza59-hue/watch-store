// The single source of truth for "can this watch be built?". Rules are listed in
// docs/feasibility-rules.md and implemented in ./checks; everything here is pure and deterministic.
import { CATALOG, getSlotDef, NONE_OPTION_ID, partsForSlot } from "../catalog";
import type { Catalog, OptionStatus, RepairResult, SlotKey, ValidationReport, WatchSpec } from "../types";
import { collectFindings, toIssue, withPart } from "./engine";
import { suggestFixes } from "./fixes";
import { repair } from "./repair";

export { describeChanges } from "./repair";

/** The brand and Swiss-indication check behind the dial-text and engraving rules, for free text. */
export { reviewText, type TextReview } from "./text";

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
