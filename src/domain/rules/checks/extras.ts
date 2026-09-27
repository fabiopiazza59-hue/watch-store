import { EXTRAS, findPart, specExtras } from "../../catalog";
import type { OrderExtras, Strap, SuggestedFix, WatchCase, WatchSpec } from "../../types";
import { A_PART, listJoin, quote } from "../format";
import { finding, type Finding, type Remedy, type RuleContext } from "../model";
import { mm, outOfTolerance } from "../units";

/**
 * Rules about what ships with the watch rather than the watch itself. Their issues name no slots
 * (extras aren't a slot), and a fix to the watch may break them: they follow the watch (see fixes.ts).
 */
export const EXTRAS_RULE_IDS: ReadonlySet<string> = new Set(["spare-strap", "extras"]);

/** The spec's extras with some fields replaced, as a fresh object for a fix's patch. */
function extrasPatch(spec: WatchSpec, changes: Partial<OrderExtras>): Partial<WatchSpec> {
  const extras = specExtras(spec);
  return { extras: { spareStrapId: extras.spareStrapId, itemIds: [...extras.itemIds], ...changes } };
}

function spareStrapRemedies(spec: WatchSpec): Remedy[] {
  const removal: SuggestedFix = { description: "Remove the spare strap", patch: extrasPatch(spec, { spareStrapId: null }) };
  return [{ swapSpareStrap: true }, { patch: removal }];
}

/** Why a strap can't go on this case: its width, or end links shaped for other cases. */
function misfits(strap: Strap, watchCase: WatchCase, catalog: RuleContext["catalog"]): { variant: string; reason: string }[] {
  const found: { variant: string; reason: string }[] = [];
  if (outOfTolerance(strap.widthMm, watchCase.lugWidthMm, 0)) {
    const verdict =
      strap.widthMm > watchCase.lugWidthMm
        ? "so it won't fit between them"
        : "so it would leave gaps at the lugs and slide around on the spring bars";
    found.push({
      variant: "width",
      reason:
        `The spare ${quote(strap.name)} strap is ${mm(strap.widthMm)} wide, but the ${quote(watchCase.name)} case ` +
        `has ${mm(watchCase.lugWidthMm)} lugs, ${verdict}.`,
    });
  }
  const fittedFor = strap.compatibleCaseIds ?? [];
  if (fittedFor.length > 0 && !fittedFor.includes(watchCase.id)) {
    const caseNames = catalog.cases.filter((c) => fittedFor.includes(c.id)).map((c) => quote(c.name));
    const shapedFor = caseNames.length > 0 ? `the ${listJoin(caseNames)} case${caseNames.length > 1 ? "s" : ""}` : "other cases";
    found.push({
      variant: "end-links",
      reason:
        `The spare ${quote(strap.name)} has solid end links shaped for ${shapedFor}; ` +
        `they won't fit the ${quote(watchCase.name)} case's lugs.`,
    });
  }
  return found;
}

/**
 * `spare-strap`: the spare strap is a catalogue strap that fits the case, like the main strap; the
 * same strap as the main one is fine but worth knowing.
 */
export function spareStrap({ spec, parts, catalog }: RuleContext): Finding[] {
  const { spareStrapId } = specExtras(spec);
  if (!spareStrapId) return [];
  const remedies = spareStrapRemedies(spec);
  const spare = catalog.straps.find((strap) => strap.id === spareStrapId);
  if (!spare) {
    const other = findPart(spareStrapId, catalog);
    const message = other
      ? `${quote(other.name)} is ${A_PART[other.category]}, not a strap, so it can't be the spare strap. Choose a strap, or no spare.`
      : `We couldn't find a strap with the id ${quote(spareStrapId)} in our parts library to add as the spare. Choose a strap, or no spare.`;
    return [finding({ ruleId: "spare-strap", variant: "unknown", severity: "error", message, slots: [], remedies })];
  }

  // Without a known case there is nothing to fit against; `missing-part` reports the case.
  const watchCase = parts.case;
  if (!watchCase) return [];
  const problems = misfits(spare, watchCase, catalog);
  if (problems.length > 0) {
    return problems.map(({ variant, reason }) =>
      finding({ ruleId: "spare-strap", variant, severity: "error", message: reason, slots: [], remedies }),
    );
  }
  if (spare.id === spec.strapId) {
    return [
      finding({
        ruleId: "spare-strap",
        variant: "same",
        severity: "info",
        message:
          `The spare strap is the same ${quote(spare.name)} strap the watch comes on, so you'll get two identical straps. ` +
          `That makes a handy replacement; for a change of look, choose a different one.`,
        slots: [],
        remedies,
      }),
    ];
  }
  return [];
}

function addOnLabel(id: string, catalog: RuleContext["catalog"]): string {
  const part = findPart(id, catalog);
  return part ? `${quote(part.name)} (${A_PART[part.category]})` : quote(id);
}

/** `extras`: every add-on is one the workshop offers, listed once. */
export function extrasItems({ spec, catalog }: RuleContext): Finding[] {
  const { itemIds } = specExtras(spec);
  if (itemIds.length === 0) return [];
  const findings: Finding[] = [];

  const unknown = [...new Set(itemIds.filter((id) => !EXTRAS.some((extra) => extra.id === id)))];
  if (unknown.length > 0) {
    const plural = unknown.length > 1;
    const strapHint = unknown.some((id) => catalog.straps.some((strap) => strap.id === id))
      ? " A strap goes in as the spare strap instead."
      : "";
    findings.push(
      finding({
        ruleId: "extras",
        variant: "unknown",
        severity: "error",
        message:
          `We don't offer ${plural ? "add-ons" : "an add-on"} called ${listJoin(unknown.map((id) => addOnLabel(id, catalog)))}, ` +
          `so we can't include ${plural ? "them" : "it"}.${strapHint}`,
        slots: [],
        remedies: [
          {
            patch: {
              description: plural ? "Remove the unknown add-ons" : "Remove the unknown add-on",
              patch: extrasPatch(spec, { itemIds: itemIds.filter((id) => !unknown.includes(id)) }),
            },
          },
        ],
      }),
    );
  }

  const repeated = [...new Set(itemIds.filter((id, index) => itemIds.indexOf(id) !== index))];
  if (repeated.length > 0) {
    const names = repeated.map((id) => quote(EXTRAS.find((extra) => extra.id === id)?.name ?? id));
    const plural = repeated.length > 1;
    findings.push(
      finding({
        ruleId: "extras",
        variant: "duplicate",
        severity: "error",
        message: `${listJoin(names)} ${plural ? "are each" : "is"} listed more than once; each add-on comes once per order.`,
        slots: [],
        remedies: [
          {
            patch: {
              description: "Remove the duplicates",
              patch: extrasPatch(spec, { itemIds: itemIds.filter((id, index) => itemIds.indexOf(id) === index) }),
            },
          },
        ],
      }),
    );
  }
  return findings;
}
