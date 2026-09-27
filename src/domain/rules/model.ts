import type { Catalog, ResolvedSpec, Severity, SlotKey, SuggestedFix, WatchSpec } from "../types";

/** What a rule sees: the spec, its parts resolved against the catalogue, and the catalogue itself. */
export interface RuleContext {
  spec: WatchSpec;
  parts: ResolvedSpec;
  catalog: Catalog;
}

/**
 * One way to look for fixes, in order of preference: swap the part in a slot for catalogue
 * alternatives, swap the spare strap for other straps, or apply a fixed patch (clear a text,
 * remove an insert).
 */
export type Remedy = { swap: SlotKey } | { swapSpareStrap: true } | { patch: SuggestedFix };

/** An issue as a rule reports it, before fixes are searched for. */
export interface Finding {
  /**
   * Identifies the failed condition across candidate specs ("bezel-insert:size"), so a fix can be
   * checked to make exactly this problem go away and to introduce no other error.
   */
  key: string;
  ruleId: string;
  severity: Severity;
  message: string;
  slots: SlotKey[];
  remedies: Remedy[];
}

export type Rule = (ctx: RuleContext) => Finding[];

interface FindingInput {
  ruleId: string;
  /** Names the failed condition when a rule checks several (e.g. "missing" vs "size"). */
  variant?: string;
  severity: Severity;
  message: string;
  slots: SlotKey[];
  remedies?: Remedy[];
}

export function finding({ variant, remedies = [], ...issue }: FindingInput): Finding {
  return { ...issue, key: variant ? `${issue.ruleId}:${variant}` : issue.ruleId, remedies };
}

/** Swap remedies for the given slots, most preferred first. */
export function swaps(...slots: SlotKey[]): Remedy[] {
  return slots.map((slot) => ({ swap: slot }));
}
