import { crownLabel, dateWindowLabel, quote } from "../format";
import { finding, swaps, type Finding, type RuleContext } from "../model";
import { isLess, mm, outOfTolerance } from "../units";

/** Largest difference between dial and dial seat that still seats snugly. */
export const DIAL_SEAT_TOLERANCE_MM = 0.2;

/** `dial-size`: the dial matches the case's dial seat. */
export function dialSize({ parts }: RuleContext): Finding[] {
  const { case: watchCase, dial } = parts;
  if (!watchCase || !dial) return [];
  if (!outOfTolerance(dial.diameterMm, watchCase.dialDiameterMm, DIAL_SEAT_TOLERANCE_MM)) return [];
  const excess = dial.diameterMm - watchCase.dialDiameterMm;
  const verdict =
    excess > 0
      ? `${mm(excess)} too big, so it won't seat`
      : `${mm(-excess)} too small, so it would sit loose and could shift or rattle ` +
        `(up to ${mm(DIAL_SEAT_TOLERANCE_MM)} of play is fine)`;
  return [
    finding({
      ruleId: "dial-size",
      severity: "error",
      message:
        `The ${quote(watchCase.name)} case takes a ${mm(watchCase.dialDiameterMm, 1)} dial; ` +
        `the ${quote(dial.name)} dial is ${mm(dial.diameterMm, 1)}, ${verdict}.`,
      slots: ["dialId", "caseId"],
      remedies: swaps("dialId", "caseId"),
    }),
  ];
}

/**
 * How much wider than the outermost hand pinion a dial's centre hole must be: the wheel pipe widens
 * below the tip the hand presses onto. Standard NH dials (about 2.05 mm) clear the NH35's 1.50 mm
 * hour pinion this way; the NH34's 2.20 mm 24h pinion needs an NH34-ready dial of about 2.7 mm.
 */
export const DIAL_HOLE_CLEARANCE_MM = 0.5;

/** `dial-center-hole`: the dial's centre hole clears the movement's outermost wheel pipe. */
export function dialCenterHole({ parts }: RuleContext): Finding[] {
  const { movement, dial } = parts;
  if (!movement || !dial) return [];
  const gmt = movement.handHolesMm.gmt;
  const required = Math.max(movement.handHolesMm.hour, gmt ?? 0) + DIAL_HOLE_CLEARANCE_MM;
  if (!isLess(dial.centerHoleMm, required)) return [];
  const wheel = gmt !== undefined ? "24-hour wheel" : "hour wheel";
  return [
    finding({
      ruleId: "dial-center-hole",
      severity: "error",
      message:
        `The ${movement.caliber}'s ${wheel} needs a dial centre hole of at least ${mm(required, 1)}; ` +
        `the ${quote(dial.name)} dial's hole is ${mm(dial.centerHoleMm)}, so the dial wouldn't sit flat over it` +
        (gmt !== undefined ? ". A GMT movement needs a GMT-ready dial." : "."),
      slots: ["dialId", "movementId"],
      remedies: swaps("dialId", "movementId"),
    }),
  ];
}

/** `dial-crown-position`: the dial is laid out for the case's crown position. */
export function dialCrownPosition({ parts }: RuleContext): Finding[] {
  const { case: watchCase, dial } = parts;
  if (!watchCase || !dial || dial.crownPosition === watchCase.crownPosition) return [];
  const dateConsequence = dial.dateWindow === "none" ? "" : " and the date window wouldn't line up with the date";
  return [
    finding({
      ruleId: "dial-crown-position",
      severity: "error",
      message:
        `The ${quote(dial.name)} dial is made for a crown at ${crownLabel(dial.crownPosition)}, ` +
        `but the ${quote(watchCase.name)} case has its crown at ${crownLabel(watchCase.crownPosition)}. ` +
        `The dial's feet are placed for its own crown position, so here it would sit rotated${dateConsequence}.`,
      slots: ["dialId", "caseId"],
      remedies: swaps("dialId", "caseId"),
    }),
  ];
}

/** `date-window`: the dial's aperture matches what the movement can show. */
export function dateWindow({ parts }: RuleContext): Finding[] {
  const { movement, dial } = parts;
  if (!movement || !dial) return [];
  const shows = movement.dateDisplay;
  const dialName = quote(dial.name);

  if (dial.dateWindow !== "none" && shows === "none") {
    return [
      finding({
        ruleId: "date-window",
        variant: "unsupported",
        severity: "error",
        message:
          `The ${dialName} dial has ${dateWindowLabel(dial.dateWindow)}, but the ${movement.caliber} ` +
          `has no date wheel, so the window would open onto bare movement instead of a date.`,
        slots: ["dialId", "movementId"],
        remedies: swaps("dialId", "movementId"),
      }),
    ];
  }
  if (dial.dateWindow === "day-date-3" && shows === "date-3") {
    return [
      finding({
        ruleId: "date-window",
        variant: "unsupported",
        severity: "error",
        message:
          `The ${dialName} dial has a day-date window, but the ${movement.caliber} only turns a date wheel, ` +
          `so the day half of the window would stay blank.`,
        slots: ["dialId", "movementId"],
        remedies: swaps("dialId", "movementId"),
      }),
    ];
  }
  // For the warnings, a movement swap comes first: it keeps the dial the customer chose and removes
  // the hidden function at its source.
  if (dial.dateWindow === "none" && movement.hasDateWheel) {
    return [
      finding({
        ruleId: "date-window",
        variant: "phantom-date",
        severity: "warning",
        message:
          `The ${dialName} dial has no date window, but the ${movement.caliber} still has a date wheel underneath. ` +
          `It works fine; the crown just gets a "phantom" position that changes a date you can't see.`,
        slots: ["dialId", "movementId"],
        remedies: swaps("movementId", "dialId"),
      }),
    ];
  }
  if (dial.dateWindow === "date-3" && shows === "day-date-3") {
    return [
      finding({
        ruleId: "date-window",
        variant: "hidden-day",
        severity: "warning",
        message:
          `The ${movement.caliber} also turns a day wheel, but the ${dialName} dial only shows the date. ` +
          `It works fine; the crown's day-setting position just changes a day you can't see.`,
        slots: ["dialId", "movementId"],
        remedies: swaps("movementId", "dialId"),
      }),
    ];
  }
  return [];
}
