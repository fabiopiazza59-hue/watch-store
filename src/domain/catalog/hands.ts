import type { HandSet } from "../types";

// SEED DATA — to be expanded and fact-checked by the catalogue build step.
export const hands: HandSet[] = [
  {
    id: "hands-mercedes-silver",
    category: "hands",
    name: "Mercedes Silver",
    description: "Polished silver Mercedes hour hand, sword minute, lollipop seconds.",
    style: "mercedes",
    movementFamily: "NH3x",
    holesMm: { hour: 1.5, minute: 0.9, seconds: 0.2 },
    lengthsMm: { hour: 8.5, minute: 12.5, seconds: 13 },
    includesGmt: false,
    colorHex: "#d9dde2",
    secondsColorHex: "#d9dde2",
    lume: "green",
    costEur: 12,
    leadTimeDays: 10,
    supplierHint: "Aftermarket NH35 hand sets.",
  },
];
