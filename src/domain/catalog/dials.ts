import type { Dial } from "../types";

// SEED DATA — to be expanded and fact-checked by the catalogue build step.
export const dials: Dial[] = [
  {
    id: "dial-diver-black",
    category: "dial",
    name: "Diver Black",
    description: "Matte black dive dial, round lume plots, date at 3.",
    style: "diver",
    movementFamily: "NH3x",
    diameterMm: 28.5,
    crownPosition: 3.8,
    dateWindow: "date-3",
    colorHex: "#15171a",
    printColorHex: "#f2f2ee",
    texture: "matte",
    indices: "printed",
    lume: "green",
    has24hScale: false,
    printable: true,
    costEur: 22,
    leadTimeDays: 10,
    supplierHint: "Aftermarket NH35 dial makers; confirm dial-feet positions for 3.8 crown.",
  },
];
