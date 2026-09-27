import type { WatchCase } from "../types";

// SEED DATA — to be expanded and fact-checked by the catalogue build step.
export const cases: WatchCase[] = [
  {
    id: "case-diver-42",
    category: "case",
    name: "Classic Diver 42",
    description: "42mm steel dive case, 4 o'clock crown, 120-click bezel, 200m.",
    style: "diver",
    material: "316L steel",
    finish: "brushed & polished",
    movementFamily: "NH3x",
    diameterMm: 42,
    lugToLugMm: 46,
    thicknessMm: 13.5,
    lugWidthMm: 22,
    crownPosition: 3.8,
    screwDownCrown: true,
    dialDiameterMm: 28.5,
    crystalDiameterMm: 31.5,
    bezel: "unidirectional-120",
    insertMm: { outer: 38, inner: 30.5 },
    chapterRing: true,
    caseback: "solid",
    waterResistanceM: 200,
    handClearanceMm: 1.8,
    costEur: 55,
    leadTimeDays: 14,
    supplierHint: "Aftermarket NH35 case makers (SKX-style 'diver' pattern).",
  },
];
