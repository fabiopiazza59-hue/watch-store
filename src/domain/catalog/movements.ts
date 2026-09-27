import type { Movement } from "../types";

/**
 * Seiko Instruments / TMI "NH3x" calibres. They share the 27.4mm movement,
 * 29.36mm casing ring (with dial-holding spacer), 5.32mm height, dial feet and
 * hand pinions, so every case and dial in this catalogue fits all four; what
 * differs is the complication on the dial side.
 *
 * Hand holes are Seiko's published 150/89/21 (hundredths of a mm); aftermarket
 * hands are sold as 1.50/0.90/0.20, which the 0.02mm fit tolerance accepts.
 * See docs/parts-research.md for sources.
 */
const NH3X_HAND_HOLES = { hour: 1.5, minute: 0.89, seconds: 0.21 } as const;

export const movements: Movement[] = [
  {
    id: "mv-nh35a",
    category: "movement",
    name: "NH35A automatic",
    description: "Genuine Seiko/TMI calibre and the workhorse of the modding world: automatic, hacking, hand-winding, date at 3.",
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
    handHolesMm: { ...NH3X_HAND_HOLES },
    accuracySecPerDay: { min: -20, max: 40 },
    costEur: 55,
    leadTimeDays: 7,
    supplierHint:
      "Genuine TMI stock from an established movement distributor or mod-part shop. The same date disc serves 3 and 3.8 o'clock crown cases; choose white or black date to suit the dial.",
  },
  {
    id: "mv-nh36a",
    category: "movement",
    name: "NH36A automatic, day-date",
    description: "The NH35 with a day wheel added: day and date side by side at 3 o'clock.",
    caliber: "NH36A",
    maker: "Seiko Instruments (TMI)",
    family: "NH3x",
    complications: ["date", "day"],
    dateDisplay: "day-date-3",
    hasDateWheel: true,
    diameterMm: 27.4,
    heightMm: 5.32,
    jewels: 24,
    beatRateVph: 21600,
    powerReserveHours: 41,
    hacking: true,
    handWinding: true,
    handHolesMm: { ...NH3X_HAND_HOLES },
    accuracySecPerDay: { min: -20, max: 40 },
    costEur: 58,
    leadTimeDays: 7,
    supplierHint:
      "Order the day-wheel variant that matches the case: standard for a 3 o'clock crown, the '4 o'clock crown' version for 3.8 cases, or the day text sits crooked in the window.",
    dataNotes:
      "The day wheel is pre-aligned to one crown position, which this catalogue does not model yet; pick the variant by the case's crown position when ordering.",
  },
  {
    id: "mv-nh34a",
    category: "movement",
    name: "NH34A automatic GMT",
    description: "Adds a 24-hour hand for a second time zone, set in one-hour jumps from the crown; date at 3.",
    caliber: "NH34A",
    maker: "Seiko Instruments (TMI)",
    family: "NH3x",
    complications: ["date", "gmt"],
    dateDisplay: "date-3",
    hasDateWheel: true,
    diameterMm: 27.4,
    heightMm: 5.32,
    jewels: 24,
    beatRateVph: 21600,
    powerReserveHours: 41,
    hacking: true,
    handWinding: true,
    handHolesMm: { ...NH3X_HAND_HOLES, gmt: 2.2 },
    accuracySecPerDay: { min: -20, max: 40 },
    costEur: 95,
    leadTimeDays: 10,
    supplierHint:
      "Genuine TMI NH34A from a movement distributor; marketplace listings well below the usual price are often grey-market or refurbished.",
    dataNotes:
      "'Caller' GMT: the 24h hand is set independently, the local hour hand is not. The 24h pinion makes the hand stack about 0.4mm taller, and the dial needs a centre hole of about 2.7-2.9mm (standard NH35 dials are about 2.05mm), so pair it with a GMT dial.",
  },
  {
    id: "mv-nh38a",
    category: "movement",
    name: "NH38A automatic, no-date",
    description: "A true no-date NH: no date wheel, so no dead 'phantom' crown position. Ideal for clean dials.",
    caliber: "NH38A",
    maker: "Seiko Instruments (TMI)",
    family: "NH3x",
    complications: [],
    dateDisplay: "none",
    hasDateWheel: false,
    diameterMm: 27.4,
    heightMm: 5.32,
    jewels: 24,
    beatRateVph: 21600,
    powerReserveHours: 41,
    hacking: true,
    handWinding: true,
    handHolesMm: { ...NH3X_HAND_HOLES },
    accuracySecPerDay: { min: -20, max: 40 },
    costEur: 70,
    leadTimeDays: 10,
    supplierHint: "Genuine TMI NH38A from a movement distributor or mod-part shop; stocked less widely than the NH35.",
    dataNotes:
      "The main plate is open at 9 o'clock so an open-heart dial can show the balance; with a solid dial the opening is simply hidden.",
  },
];
