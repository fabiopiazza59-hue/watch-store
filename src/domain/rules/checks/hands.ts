import type { Movement } from "../../types";
import { listJoin, quote } from "../format";
import { finding, swaps, type Finding, type RuleContext } from "../model";
import { isGreater, isLess, mm, outOfTolerance } from "../units";

/** Largest difference between a hand's hole and its pinion for a secure press fit. */
export const HAND_HOLE_TOLERANCE_MM = 0.02;
/** Gap a hand tip must keep from the dial's edge (chapter ring / case). */
export const HAND_TIP_CLEARANCE_MM = 0.3;
/** Below this share of the dial radius a minute hand looks undersized. */
export const MIN_MINUTE_HAND_RATIO = 0.75;
/** Hand clearance a four-hand GMT stack needs to be fitted comfortably. */
export const MIN_GMT_STACK_CLEARANCE_MM = 1.6;

const PRESSED_HANDS = ["hour", "minute", "seconds"] as const;

export function isGmtMovement(movement: Movement): boolean {
  return movement.complications.includes("gmt");
}

/** `hand-fit`: hour, minute and seconds holes match the movement's pinions. */
export function handFit({ parts }: RuleContext): Finding[] {
  const { movement, hands } = parts;
  if (!movement || !hands) return [];
  const misfits = PRESSED_HANDS.filter((hand) =>
    outOfTolerance(hands.holesMm[hand], movement.handHolesMm[hand], HAND_HOLE_TOLERANCE_MM),
  );
  if (misfits.length === 0) return [];
  const details = misfits.map(
    (hand) =>
      `the ${hand} hand's hole is ${mm(hands.holesMm[hand], 2)} but its pinion is ${mm(movement.handHolesMm[hand], 2)}`,
  );
  return [
    finding({
      ruleId: "hand-fit",
      severity: "error",
      message:
        `The ${quote(hands.name)} hands don't fit the ${movement.caliber}: ${listJoin(details)}. ` +
        `Hands must match their pinion within ${mm(HAND_HOLE_TOLERANCE_MM)}, or they sit loose or can't be pressed on.`,
      slots: ["handsId", "movementId"],
      remedies: swaps("handsId", "movementId"),
    }),
  ];
}

/** `gmt-hand`: a GMT movement gets a GMT hand, and a GMT hand gets a pinion of its size. */
export function gmtHand({ parts, catalog }: RuleContext): Finding[] {
  const { movement, hands } = parts;
  if (!movement || !hands) return [];
  const handsName = quote(hands.name);
  const gmtPinion = movement.handHolesMm.gmt;
  const gmtHole = hands.holesMm.gmt;
  const report = (variant: string, message: string) => [
    finding({
      ruleId: "gmt-hand",
      variant,
      severity: "error",
      message,
      slots: ["handsId", "movementId"],
      remedies: swaps("handsId", "movementId"),
    }),
  ];

  if (isGmtMovement(movement) && !hands.includesGmt) {
    return report(
      "missing",
      `The ${movement.caliber} is a GMT movement with a fourth hand for a second time zone, ` +
        `but the ${handsName} set has no GMT hand, so that function would have nothing to show it.`,
    );
  }
  if (hands.includesGmt && gmtPinion === undefined) {
    const gmtCalibers = catalog.movements.filter(isGmtMovement).map((m) => `${m.caliber} GMT`);
    const choose = gmtCalibers.length > 0 ? `Choose the ${listJoin(gmtCalibers)} movement or hands` : "Choose hands";
    return report(
      "no-pinion",
      `The ${handsName} set includes a GMT hand, but the ${movement.caliber} has no fourth (24-hour) hand to fit it to. ` +
        `${choose} without a GMT hand.`,
    );
  }
  if (gmtPinion !== undefined && gmtHole !== undefined && outOfTolerance(gmtHole, gmtPinion, HAND_HOLE_TOLERANCE_MM)) {
    return report(
      "size",
      `The ${handsName} GMT hand's hole is ${mm(gmtHole, 2)}, but the ${movement.caliber}'s GMT pinion is ` +
        `${mm(gmtPinion, 2)}. It must match within ${mm(HAND_HOLE_TOLERANCE_MM)} to press on securely.`,
    );
  }
  return [];
}

/** `hand-length`: hands reach the minute track without fouling the edge of the dial. */
export function handLength({ parts }: RuleContext): Finding[] {
  const { dial, hands } = parts;
  if (!dial || !hands) return [];
  const radius = dial.diameterMm / 2;
  const maxReach = radius - HAND_TIP_CLEARANCE_MM;
  const findings: Finding[] = [];

  const tooLong = (["minute", "seconds"] as const).filter((hand) => isGreater(hands.lengthsMm[hand], maxReach));
  if (tooLong.length > 0) {
    const lengths = tooLong.map((hand) => `the ${hand} hand is ${mm(hands.lengthsMm[hand])}`);
    findings.push(
      finding({
        ruleId: "hand-length",
        variant: "too-long",
        severity: "error",
        message:
          `On the ${mm(dial.diameterMm, 1)} ${quote(dial.name)} dial, hands can reach at most ${mm(maxReach)} ` +
          `from the centre (${mm(HAND_TIP_CLEARANCE_MM)} clear of the edge). In the ${quote(hands.name)} set ` +
          `${listJoin(lengths)}, so ${tooLong.length > 1 ? "their tips" : "its tip"} would catch on the chapter ring or case.`,
        slots: ["handsId", "dialId"],
        remedies: swaps("handsId", "dialId"),
      }),
    );
  }

  if (isLess(hands.lengthsMm.minute, radius * MIN_MINUTE_HAND_RATIO)) {
    findings.push(
      finding({
        ruleId: "hand-length",
        variant: "too-short",
        severity: "warning",
        message:
          `The ${quote(hands.name)} minute hand is ${mm(hands.lengthsMm.minute)} long, less than three quarters ` +
          `of the ${quote(dial.name)} dial's ${mm(radius)} radius. It works, but it looks undersized and ` +
          `doesn't reach the minute track, which makes the time harder to read.`,
        slots: ["handsId", "dialId"],
        remedies: swaps("handsId", "dialId"),
      }),
    );
  }
  return findings;
}

/**
 * Seconds-hand lengths that clear the crystal when an NH34 sits in a case made for three-hand movements
 * (Lucius Atelier's NH34 clearance table): under a double-dome, up to 12.5 mm; under a flat crystal, one
 * case maker's advice is under 12 mm, and the table has no length that clears. Single-domed crystals
 * aren't in the table, so they get the flat crystal's stricter limit.
 */
export const NH34_SECONDS_HAND_MAX_MM = { doubleDome: 12.5, flatUnder: 12 } as const;

/** `hand-clearance`: a GMT's four-hand stack has room under the crystal. */
export function handClearance({ parts }: RuleContext): Finding[] {
  const { movement, case: watchCase, hands, crystal } = parts;
  if (!movement || !watchCase || !isGmtMovement(movement)) return [];
  const findings: Finding[] = [];

  if (isLess(watchCase.handClearanceMm, MIN_GMT_STACK_CLEARANCE_MM)) {
    findings.push(
      finding({
        ruleId: "hand-clearance",
        variant: "tight-stack",
        severity: "warning",
        message:
          `The ${quote(watchCase.name)} case leaves ${mm(watchCase.handClearanceMm)} above the dial for the hands, ` +
          `and a GMT's four-hand stack wants at least ${mm(MIN_GMT_STACK_CLEARANCE_MM)}. It can be built, but the ` +
          `hands may touch each other or the crystal, so it needs extra care when fitting.`,
        slots: ["caseId", "movementId"],
        remedies: swaps("caseId"),
      }),
    );
  }

  if (hands && crystal && !watchCase.nh34ReadyCrystals?.includes(crystal.shape)) {
    const seconds = hands.lengthsMm.seconds;
    const doubleDome = crystal.shape === "double-dome";
    const tooLong = doubleDome
      ? isGreater(seconds, NH34_SECONDS_HAND_MAX_MM.doubleDome)
      : !isLess(seconds, NH34_SECONDS_HAND_MAX_MM.flatUnder);
    if (tooLong) {
      const limit = doubleDome
        ? `even a double-dome crystal only clears a seconds hand up to ${mm(NH34_SECONDS_HAND_MAX_MM.doubleDome)}`
        : `a seconds hand has to be shorter than ${mm(NH34_SECONDS_HAND_MAX_MM.flatUnder)} unless the crystal is double-domed`;
      findings.push(
        finding({
          ruleId: "hand-clearance",
          variant: "seconds-crystal",
          severity: "warning",
          message:
            `The ${quote(hands.name)} seconds hand is ${mm(seconds)} long, and the ${movement.caliber}'s GMT wheel ` +
            `lifts the hands about 0.4 mm. The ${quote(watchCase.name)} case isn't sold NH34-ready with the ` +
            `${quote(crystal.name)} crystal, and in a case made for three-hand movements ${limit}. It can be built, ` +
            `but the seconds hand may brush the crystal and stop the watch.`,
          slots: ["crystalId", "handsId", "caseId", "movementId"],
          remedies: swaps("crystalId", "handsId", "caseId"),
        }),
      );
    }
  }
  return findings;
}
