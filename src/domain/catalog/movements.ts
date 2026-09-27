import type { Movement } from "../types";

// SEED DATA — to be expanded and fact-checked by the catalogue build step.
export const movements: Movement[] = [
  {
    id: "mv-nh35a",
    category: "movement",
    name: "Seiko NH35A automatic",
    description: "The workhorse of the modding world: automatic, hacking, hand-winding, date at 3.",
    caliber: "NH35A",
    maker: "Seiko Instruments (TMI)",
    family: "NH3x",
    complications: ["date"],
    dateDisplay: "date-3",
    hasDateWheel: true,
    diameterMm: 27.4,
    heightMm: 5.32,
    jewels: 24,
    beatRateVph: 21600,
    powerReserveHours: 41,
    hacking: true,
    handWinding: true,
    handHolesMm: { hour: 1.5, minute: 0.9, seconds: 0.2 },
    accuracySecPerDay: { min: -20, max: 40 },
    costEur: 38,
    leadTimeDays: 7,
    supplierHint: "Authorised TMI/Seiko movement distributors or established mod-part shops.",
  },
];
