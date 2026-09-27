import type { BezelInsert } from "../types";

// SEED DATA — to be expanded and fact-checked by the catalogue build step.
export const bezelInserts: BezelInsert[] = [
  {
    id: "insert-dive-black-alu",
    category: "bezelInsert",
    name: "Dive 60 Black (aluminium)",
    description: "Classic black aluminium 60-minute dive scale with lume pip.",
    scale: "dive-60",
    material: "aluminium",
    outerMm: 38,
    innerMm: 30.5,
    colorHex: "#16181b",
    printColorHex: "#f2f2ee",
    lumePip: true,
    costEur: 8,
    leadTimeDays: 10,
    supplierHint: "Aftermarket 38 x 30.5mm inserts.",
  },
];
