import type { BezelInsert, WatchCase } from "../../types";
import { listJoin, quote, scaleLabel } from "../format";
import { finding, swaps, type Finding, type RuleContext } from "../model";
import { mm, outOfTolerance } from "../units";
import { isGmtMovement } from "./hands";

/**
 * Largest difference between crystal and crystal seat that still presses in and seals. Crystals are
 * sold in 0.1 mm steps and one step off won't seal, so only the seat's own nominal size passes.
 */
export const CRYSTAL_SEAT_TOLERANCE_MM = 0.05;
/** Largest difference between insert and bezel seat (outer and inner diameter). */
export const INSERT_SEAT_TOLERANCE_MM = 0.1;

function takesInsert(watchCase: WatchCase): boolean {
  return watchCase.bezel === "unidirectional-120" || watchCase.bezel === "bidirectional-24h";
}

function insertSize(outer: number, inner: number): string {
  return `${outer.toFixed(1)} × ${inner.toFixed(1)} mm`;
}

/** `crystal-fit`: the crystal matches the case's crystal seat. */
export function crystalFit({ parts }: RuleContext): Finding[] {
  const { case: watchCase, crystal } = parts;
  if (!watchCase || !crystal) return [];
  if (!outOfTolerance(crystal.diameterMm, watchCase.crystalDiameterMm, CRYSTAL_SEAT_TOLERANCE_MM)) return [];
  const excess = crystal.diameterMm - watchCase.crystalDiameterMm;
  const verdict =
    excess > 0
      ? `${mm(excess)} too big, so it won't press into the case`
      : `${mm(-excess)} too small, so it can't be pressed in tightly enough to seal`;
  return [
    finding({
      ruleId: "crystal-fit",
      severity: "error",
      message:
        `The ${quote(watchCase.name)} case takes a ${mm(watchCase.crystalDiameterMm, 1)} crystal; ` +
        `the ${quote(crystal.name)} crystal is ${mm(crystal.diameterMm, 1)}, ${verdict}.`,
      slots: ["crystalId", "caseId"],
      remedies: swaps("crystalId"),
    }),
  ];
}

/** `bezel-insert`: insert bezels get an insert of the right size, and only they get one. */
export function bezelInsert({ spec, parts }: RuleContext): Finding[] {
  const { case: watchCase, bezelInsert: insert } = parts;
  if (!watchCase) return [];

  if (!takesInsert(watchCase)) {
    if (!insert) return [];
    const bezel = watchCase.bezel === "fixed" ? "a fixed bezel" : "no bezel";
    return [
      finding({
        ruleId: "bezel-insert",
        variant: "no-seat",
        severity: "error",
        message:
          `The ${quote(watchCase.name)} case has ${bezel} with no insert seat, ` +
          `so there's nowhere to fit the ${quote(insert.name)} insert.`,
        slots: ["bezelInsertId", "caseId"],
        remedies: [
          { patch: { description: "Remove the bezel insert", patch: { bezelInsertId: null } } },
          ...swaps("caseId"),
        ],
      }),
    ];
  }

  const seat = watchCase.insertMm;
  if (!spec.bezelInsertId) {
    const size = seat ? ` (${insertSize(seat.outer, seat.inner)})` : "";
    return [
      finding({
        ruleId: "bezel-insert",
        variant: "missing",
        severity: "error",
        message: `The ${quote(watchCase.name)} case has a rotating bezel that needs an insert${size}. Choose one to finish the bezel.`,
        slots: ["bezelInsertId", "caseId"],
        remedies: swaps("bezelInsertId"),
      }),
    ];
  }

  if (
    insert &&
    seat &&
    (outOfTolerance(insert.outerMm, seat.outer, INSERT_SEAT_TOLERANCE_MM) ||
      outOfTolerance(insert.innerMm, seat.inner, INSERT_SEAT_TOLERANCE_MM))
  ) {
    return [
      finding({
        ruleId: "bezel-insert",
        variant: "size",
        severity: "error",
        message:
          `The ${quote(insert.name)} insert is ${insertSize(insert.outerMm, insert.innerMm)}, but the ` +
          `${quote(watchCase.name)} case's bezel takes ${insertSize(seat.outer, seat.inner)} inserts. ` +
          `More than ${mm(INSERT_SEAT_TOLERANCE_MM)} off, it won't sit flush or stay in place.`,
        slots: ["bezelInsertId", "caseId"],
        remedies: swaps("bezelInsertId"),
      }),
    ];
  }
  return [];
}

function scaleMismatch(watchCase: WatchCase, insert: BezelInsert): Finding[] {
  if (watchCase.bezel === "bidirectional-24h" && insert.scale !== "gmt-24") {
    return [
      finding({
        ruleId: "bezel-scale",
        variant: "needs-24h-insert",
        severity: "warning",
        message:
          `The ${quote(watchCase.name)} case's bezel turns both ways in 24 steps, made for a 24-hour GMT scale, ` +
          `but the ${quote(insert.name)} insert has a ${scaleLabel(insert.scale)} scale. It fits, but you won't ` +
          `be able to read a second time zone off the bezel.`,
        slots: ["bezelInsertId", "caseId"],
        remedies: swaps("bezelInsertId"),
      }),
    ];
  }
  if (watchCase.bezel === "unidirectional-120" && insert.scale === "gmt-24") {
    return [
      finding({
        ruleId: "bezel-scale",
        variant: "24h-on-dive-bezel",
        severity: "warning",
        message:
          `The ${quote(insert.name)} 24-hour insert sits on the ${quote(watchCase.name)} case's one-way, ` +
          `120-click dive bezel. It fits, but a 24-hour scale is set by turning both ways, so tracking a ` +
          `second time zone will be awkward.`,
        slots: ["bezelInsertId", "caseId"],
        remedies: swaps("bezelInsertId", "caseId"),
      }),
    ];
  }
  return [];
}

/** `bezel-scale`: the insert's scale suits the bezel action, and a GMT hand has a 24-hour scale. */
export function bezelScale({ parts }: RuleContext): Finding[] {
  const { case: watchCase, bezelInsert: insert, movement, dial } = parts;
  const findings = watchCase && insert ? scaleMismatch(watchCase, insert) : [];
  if (movement && dial && isGmtMovement(movement) && !dial.has24hScale && insert?.scale !== "gmt-24") {
    findings.push(
      finding({
        ruleId: "bezel-scale",
        variant: "no-24h-scale",
        severity: "warning",
        message:
          `The ${movement.caliber}'s GMT hand goes round once every 24 hours, but neither the ` +
          `${quote(dial.name)} dial nor the bezel has a 24-hour scale, so there's nothing to read the ` +
          `second time zone against.`,
        slots: ["movementId", "dialId", "bezelInsertId"],
        remedies: swaps("bezelInsertId", "dialId"),
      }),
    );
  }
  return findings;
}

/** `strap-width`: the strap fits between the lugs, and fitted end links suit this case. */
export function strapWidth({ parts, catalog }: RuleContext): Finding[] {
  const { case: watchCase, strap } = parts;
  if (!watchCase || !strap) return [];
  const findings: Finding[] = [];

  if (outOfTolerance(strap.widthMm, watchCase.lugWidthMm, 0)) {
    const verdict =
      strap.widthMm > watchCase.lugWidthMm
        ? "so it won't fit between them"
        : "so it would leave gaps at the lugs and slide around on the spring bars";
    findings.push(
      finding({
        ruleId: "strap-width",
        variant: "width",
        severity: "error",
        message:
          `The ${quote(watchCase.name)} case has ${mm(watchCase.lugWidthMm)} lugs; ` +
          `the ${quote(strap.name)} strap is ${mm(strap.widthMm)} wide, ${verdict}.`,
        slots: ["strapId", "caseId"],
        remedies: swaps("strapId"),
      }),
    );
  }

  const fittedFor = strap.compatibleCaseIds ?? [];
  if (fittedFor.length > 0 && !fittedFor.includes(watchCase.id)) {
    const caseNames = catalog.cases.filter((c) => fittedFor.includes(c.id)).map((c) => quote(c.name));
    const shapedFor = caseNames.length > 0 ? `the ${listJoin(caseNames)} case${caseNames.length > 1 ? "s" : ""}` : "other cases";
    findings.push(
      finding({
        ruleId: "strap-width",
        variant: "end-links",
        severity: "error",
        message:
          `The ${quote(strap.name)} has solid end links shaped for ${shapedFor}; ` +
          `they won't fit the ${quote(watchCase.name)} case's lugs.`,
        slots: ["strapId", "caseId"],
        remedies: swaps("strapId"),
      }),
    );
  }
  return findings;
}
