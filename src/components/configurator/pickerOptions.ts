import { findPart, NONE_OPTION_ID } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { evaluateOptions, repairAround } from "@/domain/rules";
import type { Issue, Part, RepairResult, SlotKey, WatchSpec } from "@/domain/types";
import { type Fit, fitOf, leadIssue } from "./fit";

export interface PickerOption {
  /** The option's id in the picker: a part id, or NONE_OPTION_ID for "no part". */
  optionId: string;
  /** What goes into the spec: the part id, or null for "no part". */
  partId: string | null;
  part?: Part;
  fit: Fit;
  /** The issue that best explains the fit, as the design stands. */
  reason?: Issue;
  /** For "fits-with-changes": the whole design, with the other parts changed to suit this one. */
  adjusted?: RepairResult;
  /** How choosing it moves the customer's price (of the adjusted design, when there is one). */
  priceDeltaEur: number;
}

/**
 * Every option for a slot, judged against the rest of the design. An option that won't fit as the
 * design stands is tried once more with the other parts repaired around it, keeping `keepSlot` (the
 * part the customer chose last) too: when that makes the design buildable, it "fits with changes".
 * The selected option is left as it is; choosing it again would change nothing.
 */
export function pickerOptions(slot: SlotKey, spec: WatchSpec, keepSlot: SlotKey | null): PickerOption[] {
  const currentPrice = priceSpec(spec).retailInclVatEur;
  const selectedId = spec[slot] || NONE_OPTION_ID;
  const locked = keepSlot && keepSlot !== slot ? [slot, keepSlot] : [slot];
  return evaluateOptions(slot, spec).map((status) => {
    const partId = status.partId === NONE_OPTION_ID ? null : status.partId;
    const candidate: WatchSpec = { ...spec, [slot]: partId };
    const repaired = status.compatible || status.partId === selectedId ? null : repairAround(candidate, locked);
    const adjusted = repaired?.report.buildable ? repaired : undefined;
    return {
      optionId: status.partId,
      partId,
      part: findPart(partId),
      fit: adjusted ? "fits-with-changes" : fitOf(status),
      reason: leadIssue(status),
      adjusted,
      priceDeltaEur: priceSpec(adjusted?.spec ?? candidate).retailInclVatEur - currentPrice,
    };
  });
}
