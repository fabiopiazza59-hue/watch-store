import type { Crystal } from "../types";

// SEED DATA — to be expanded and fact-checked by the catalogue build step.
export const crystals: Crystal[] = [
  {
    id: "crystal-sapphire-flat-315",
    category: "crystal",
    name: "Sapphire flat 31.5mm",
    description: "Flat sapphire crystal with inner AR coating.",
    material: "sapphire",
    shape: "flat",
    diameterMm: 31.5,
    thicknessMm: 2.5,
    arCoating: "inner",
    costEur: 14,
    leadTimeDays: 10,
    supplierHint: "Usually supplied with the case; spares from the case maker.",
  },
];
