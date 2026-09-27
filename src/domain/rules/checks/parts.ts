import { findPart, SLOTS } from "../../catalog";
import type { Catalog, Part, ResolvedSpec, SlotDef, SlotKey } from "../../types";
import { A_PART, PART_NOUN, quote } from "../format";
import { finding, swaps, type Finding, type RuleContext } from "../model";

function partInSlot(parts: ResolvedSpec, slot: SlotKey): Part | undefined {
  switch (slot) {
    case "movementId":
      return parts.movement;
    case "caseId":
      return parts.case;
    case "dialId":
      return parts.dial;
    case "handsId":
      return parts.hands;
    case "crystalId":
      return parts.crystal;
    case "bezelInsertId":
      return parts.bezelInsert;
    case "strapId":
      return parts.strap;
  }
}

function missingPartMessage(def: SlotDef, id: string | null, catalog: Catalog): string {
  const wanted = A_PART[def.category];
  if (!id) return `No ${PART_NOUN[def.category]} chosen yet: the watch can't be assembled without ${wanted}.`;
  const choose = def.optional ? `Choose ${wanted} from the list, or none.` : `Choose ${wanted} from the list.`;
  const other = findPart(id, catalog);
  if (other) return `${quote(other.name)} is ${A_PART[other.category]}, not ${wanted}. ${choose}`;
  return `We couldn't find ${wanted} with the id ${quote(id)} in our parts library. ${choose}`;
}

/** `missing-part`: every required slot holds a known part of the right kind. */
export function missingParts({ spec, parts, catalog }: RuleContext): Finding[] {
  return SLOTS.flatMap((def) => {
    const id = spec[def.slot];
    if (partInSlot(parts, def.slot) || (def.optional && !id)) return [];
    return [
      finding({
        ruleId: "missing-part",
        variant: def.slot,
        severity: "error",
        message: missingPartMessage(def, id, catalog),
        slots: [def.slot],
        remedies:
          def.slot === "bezelInsertId"
            ? [{ patch: { description: "Remove the bezel insert", patch: { bezelInsertId: null } } }, ...swaps(def.slot)]
            : swaps(def.slot),
      }),
    ];
  });
}

const FAMILY_CONSEQUENCE = {
  caseId: "the movement won't fit the case's movement seat",
  dialId: "the dial feet won't line up with the movement's holes",
  handsId: "the hands won't fit the movement's pinions",
} as const;

/** `movement-family`: case, dial and hands are made for the movement's family. */
export function movementFamily({ parts }: RuleContext): Finding[] {
  const { movement } = parts;
  if (!movement) return [];
  const madeFor = [
    ["caseId", parts.case],
    ["dialId", parts.dial],
    ["handsId", parts.hands],
  ] as const;
  return madeFor.flatMap(([slot, part]) =>
    part && part.movementFamily !== movement.family
      ? [
          finding({
            ruleId: "movement-family",
            variant: slot,
            severity: "error",
            message:
              `The ${quote(part.name)} ${PART_NOUN[part.category]} is made for the ${part.movementFamily} movement family, ` +
              `but the ${movement.caliber} belongs to the ${movement.family} family, so ${FAMILY_CONSEQUENCE[slot]}.`,
            slots: [slot, "movementId"],
            remedies: swaps(slot, "movementId"),
          }),
        ]
      : [],
  );
}
