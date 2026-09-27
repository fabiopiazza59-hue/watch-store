// CONTRACT STUB — implemented by the rules-engine build step. Keep these signatures.
import type { Catalog, OptionStatus, RepairResult, SlotKey, ValidationReport, WatchSpec } from "../types";
import { CATALOG } from "../catalog";

/** Validate a full spec against every compatibility rule. Deterministic, pure. */
export function validateSpec(spec: WatchSpec, catalog: Catalog = CATALOG): ValidationReport {
  void spec; void catalog;
  throw new Error("validateSpec: not implemented");
}

/** For each candidate part of `slot`, report whether swapping it into `spec` is compatible. */
export function evaluateOptions(slot: SlotKey, spec: WatchSpec, catalog: Catalog = CATALOG): OptionStatus[] {
  void slot; void spec; void catalog;
  throw new Error("evaluateOptions: not implemented");
}

/** Greedily apply suggested fixes until the spec is buildable or no fix makes progress. */
export function repairSpec(spec: WatchSpec, catalog: Catalog = CATALOG): RepairResult {
  void spec; void catalog;
  throw new Error("repairSpec: not implemented");
}
