// The configurator's view of the extras: what a spare strap or an add-on does to the design and the
// price. Whether a spare strap fits is the rules engine's call (evaluateSpareStraps); this only
// arranges its answers for the panel.
import { CATALOG, EXTRAS, NO_EXTRAS, NONE_OPTION_ID, specExtras } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { evaluateSpareStraps } from "@/domain/rules";
import type { Extra, Issue, OptionStatus, OrderExtras, Strap, WatchSpec } from "@/domain/types";
import { type Fit, fitOf, leadIssue } from "./fit";

/** Rules whose issues are about the extras rather than a part of the watch (their `slots` are empty). */
const EXTRAS_RULE_IDS: readonly string[] = ["spare-strap", "extras"];

export function isExtrasIssue(issue: Issue): boolean {
  return EXTRAS_RULE_IDS.includes(issue.ruleId);
}

export function withExtras(spec: WatchSpec, extras: OrderExtras): WatchSpec {
  return { ...spec, extras };
}

export function setSpareStrap(extras: OrderExtras, spareStrapId: string | null): OrderExtras {
  return { ...extras, spareStrapId };
}

/**
 * The add-ons with `id` added or removed, in catalogue order. Ids the catalogue doesn't list are kept
 * after them: the rules engine reports those, with a fix, rather than this dropping them unseen.
 */
export function toggleExtraItem(extras: OrderExtras, id: string, on: boolean): OrderExtras {
  const wanted = new Set(extras.itemIds);
  if (on) wanted.add(id);
  else wanted.delete(id);
  const listed = EXTRAS.filter((extra) => wanted.has(extra.id)).map((extra) => extra.id);
  const unlisted = [...wanted].filter((itemId) => !EXTRAS.some((extra) => extra.id === itemId));
  return { ...extras, itemIds: [...listed, ...unlisted] };
}

/** True when the design carries any extra at all. */
export function hasExtras(extras: OrderExtras): boolean {
  return extras.spareStrapId !== null || extras.itemIds.length > 0;
}

const retail = (spec: WatchSpec) => priceSpec(spec).retailInclVatEur;

export interface SpareStrapOption {
  /** The option's id in the picker: a strap id, or NONE_OPTION_ID for "no spare strap". */
  optionId: string;
  /** What goes into `extras.spareStrapId`. */
  strapId: string | null;
  strap?: Strap;
  fit: Fit;
  /** The issue that best explains the fit. */
  reason?: Issue;
  /** How choosing it moves the customer's price. */
  priceDeltaEur: number;
}

/** Every spare strap option (no spare strap first), judged by the rules engine against the case. */
export function spareStrapOptions(
  spec: WatchSpec,
  statuses: OptionStatus[] = evaluateSpareStraps(spec),
): SpareStrapOption[] {
  const extras = specExtras(spec);
  const currentPrice = retail(spec);
  return statuses.map((status) => {
    const strapId = status.partId === NONE_OPTION_ID ? null : status.partId;
    return {
      optionId: status.partId,
      strapId,
      strap: strapId ? CATALOG.straps.find((strap) => strap.id === strapId) : undefined,
      fit: fitOf(status),
      reason: leadIssue(status),
      priceDeltaEur: retail(withExtras(spec, setSpareStrap(extras, strapId))) - currentPrice,
    };
  });
}

/**
 * The options the picker lists: all of them, or by default only those that fit. "No spare strap"
 * and the chosen one always stay, so the customer can see (and fix) a choice that no longer fits.
 */
export function visibleSpareStrapOptions(
  options: SpareStrapOption[],
  selectedId: string,
  showAll: boolean,
): SpareStrapOption[] {
  if (showAll) return options;
  return options.filter(
    (option) => option.optionId === NONE_OPTION_ID || option.optionId === selectedId || option.fit !== "wont-fit",
  );
}

/**
 * Add-ons as a customer thinks of them: what comes in the box (packaging, then the gift touch, then
 * the tool), then extra time at the bench. Every kind is in exactly one group.
 */
export const ADD_ON_GROUPS: { title: string; kinds: Extra["kind"][] }[] = [
  { title: "In the box", kinds: ["packaging", "gift", "tool"] },
  { title: "At the bench", kinds: ["service"] },
];

export interface AddOnOption {
  extra: Extra;
  selected: boolean;
  /** What the add-on adds to the price: the price with it less the price without it, both VAT-inclusive. */
  priceDeltaEur: number;
}

export interface AddOnGroup {
  title: string;
  options: AddOnOption[];
}

export function addOnGroups(spec: WatchSpec, extras: Extra[] = EXTRAS): AddOnGroup[] {
  const chosen = specExtras(spec);
  const option = (extra: Extra): AddOnOption => ({
    extra,
    selected: chosen.itemIds.includes(extra.id),
    priceDeltaEur:
      retail(withExtras(spec, toggleExtraItem(chosen, extra.id, true))) -
      retail(withExtras(spec, toggleExtraItem(chosen, extra.id, false))),
  });
  return ADD_ON_GROUPS.map(({ title, kinds }) => ({
    title,
    options: kinds.flatMap((kind) => extras.filter((extra) => extra.kind === kind)).map(option),
  })).filter((group) => group.options.length > 0);
}

/** What all the design's extras together add to its price. */
export function extrasPriceEur(spec: WatchSpec): number {
  return retail(spec) - retail(withExtras(spec, NO_EXTRAS));
}
