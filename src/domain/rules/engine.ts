import { resolveSpec } from "../catalog";
import type { Catalog, Issue, Severity, SlotKey, WatchSpec } from "../types";
import { RULES } from "./checks";
import type { Finding } from "./model";

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** Every rule's findings for `spec`: errors, then warnings, then info, each in rule order. */
export function collectFindings(spec: WatchSpec, catalog: Catalog): Finding[] {
  const ctx = { spec, parts: resolveSpec(spec, catalog), catalog };
  return RULES.flatMap((rule) => rule(ctx)).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

export function toIssue({ ruleId, severity, message, slots }: Finding, fixes: Issue["fixes"]): Issue {
  return { ruleId, severity, message, slots, fixes };
}

/** The spec with one slot changed; `null` empties the optional bezel insert slot. */
export function withPart(spec: WatchSpec, slot: SlotKey, partId: string | null): WatchSpec {
  const next = { ...spec };
  if (slot === "bezelInsertId") next.bezelInsertId = partId;
  else next[slot] = partId ?? "";
  return next;
}

export function applyPatch(spec: WatchSpec, patch: Partial<WatchSpec>): WatchSpec {
  return { ...spec, ...patch };
}
