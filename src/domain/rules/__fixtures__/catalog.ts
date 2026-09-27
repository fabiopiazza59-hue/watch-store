// Test fixture: a small, stable parts library for the rules engine tests, independent of the real
// catalogue. `BASE_SPEC` validates with no issues at all.
import type {
  BezelInsert,
  Catalog,
  Crystal,
  Dial,
  HandSet,
  Movement,
  Personalization,
  Strap,
  WatchCase,
  WatchSpec,
} from "../../types";

const sourcing = { description: "", leadTimeDays: 7, supplierHint: "" };

function movement(part: Pick<Movement, "id" | "name" | "caliber"> & Partial<Movement>): Movement {
  return {
    ...sourcing,
    category: "movement",
    family: "NH3x",
    maker: "TMI",
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
    ...part,
  };
}

function watchCase(part: Pick<WatchCase, "id" | "name"> & Partial<WatchCase>): WatchCase {
  return {
    ...sourcing,
    category: "case",
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
    ...part,
  };
}

function dial(part: Pick<Dial, "id" | "name"> & Partial<Dial>): Dial {
  return {
    ...sourcing,
    category: "dial",
    style: "diver",
    movementFamily: "NH3x",
    diameterMm: 28.5,
    centerHoleMm: 2.05,
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
    ...part,
  };
}

function hands(part: Pick<HandSet, "id" | "name"> & Partial<HandSet>): HandSet {
  return {
    ...sourcing,
    category: "hands",
    style: "mercedes",
    movementFamily: "NH3x",
    holesMm: { hour: 1.5, minute: 0.9, seconds: 0.2 },
    lengthsMm: { hour: 8.5, minute: 12.5, seconds: 13 },
    includesGmt: false,
    colorHex: "#d9dde2",
    secondsColorHex: "#d9dde2",
    lume: "green",
    costEur: 12,
    ...part,
  };
}

function crystal(part: Pick<Crystal, "id" | "name"> & Partial<Crystal>): Crystal {
  return {
    ...sourcing,
    category: "crystal",
    material: "sapphire",
    shape: "flat",
    diameterMm: 31.5,
    thicknessMm: 2.5,
    arCoating: "inner",
    costEur: 14,
    ...part,
  };
}

function insert(part: Pick<BezelInsert, "id" | "name"> & Partial<BezelInsert>): BezelInsert {
  return {
    ...sourcing,
    category: "bezelInsert",
    scale: "dive-60",
    material: "aluminium",
    outerMm: 38,
    innerMm: 30.5,
    colorHex: "#16181b",
    printColorHex: "#f2f2ee",
    lumePip: true,
    costEur: 8,
    ...part,
  };
}

function strap(part: Pick<Strap, "id" | "name"> & Partial<Strap>): Strap {
  return { ...sourcing, category: "strap", type: "rubber", widthMm: 22, colorHex: "#1b1b1b", costEur: 15, ...part };
}

const FIXTURE_CATALOG: Catalog = {
  movements: [
    movement({ id: "mv-date", name: "NH35A automatic", caliber: "NH35A" }),
    movement({
      id: "mv-nodate",
      name: "NH38A automatic",
      caliber: "NH38A",
      complications: [],
      dateDisplay: "none",
      hasDateWheel: false,
      costEur: 45,
    }),
    movement({
      id: "mv-daydate",
      name: "NH36A automatic",
      caliber: "NH36A",
      complications: ["date", "day"],
      dateDisplay: "day-date-3",
      costEur: 42,
    }),
    movement({
      id: "mv-gmt",
      name: "NH34A GMT automatic",
      caliber: "NH34A",
      complications: ["date", "gmt"],
      handHolesMm: { hour: 1.5, minute: 0.9, seconds: 0.2, gmt: 2.2 },
      costEur: 90,
    }),
  ],
  cases: [
    watchCase({ id: "case-diver", name: "Diver 42" }),
    watchCase({ id: "case-diver-display", name: "Diver 42 Exhibition", caseback: "display", costEur: 60 }),
    watchCase({
      id: "case-field",
      name: "Field 38",
      style: "field",
      finish: "brushed",
      diameterMm: 38,
      lugToLugMm: 45,
      lugWidthMm: 20,
      crownPosition: 3,
      crystalDiameterMm: 30,
      bezel: "fixed",
      insertMm: undefined,
      waterResistanceM: 100,
      handClearanceMm: 1.5,
      costEur: 48,
    }),
    watchCase({
      id: "case-gmt",
      name: "GMT 40",
      style: "gmt",
      diameterMm: 40,
      lugWidthMm: 20,
      bezel: "bidirectional-24h",
      waterResistanceM: 100,
      costEur: 70,
    }),
    watchCase({
      id: "case-dress",
      name: "Dress 39",
      style: "dress",
      finish: "polished",
      diameterMm: 39,
      lugWidthMm: 20,
      crownPosition: 3,
      dialDiameterMm: 30,
      crystalDiameterMm: 32,
      bezel: "none",
      insertMm: undefined,
      caseback: "display",
      waterResistanceM: 30,
      handClearanceMm: 1.6,
      costEur: 65,
    }),
  ],
  dials: [
    dial({ id: "dial-diver-black", name: "Diver Black" }),
    dial({ id: "dial-diver-blue", name: "Diver Blue", colorHex: "#1d3a6b", printable: false, costEur: 24 }),
    dial({ id: "dial-diver-black-nodate", name: "Diver Black No-Date", dateWindow: "none" }),
    dial({ id: "dial-diver-daydate", name: "Diver Black Day-Date", dateWindow: "day-date-3", costEur: 26 }),
    dial({
      id: "dial-field-cream",
      name: "Field Cream",
      style: "field",
      crownPosition: 3,
      colorHex: "#efe6d2",
      printColorHex: "#1b1b1b",
      indices: "arabic",
      costEur: 20,
    }),
    dial({ id: "dial-gmt-black", name: "GMT Black", style: "gmt", has24hScale: true, centerHoleMm: 2.8, costEur: 30 }),
    dial({
      id: "dial-dress-silver",
      name: "Dress Silver",
      style: "dress",
      diameterMm: 30,
      crownPosition: 3,
      dateWindow: "none",
      colorHex: "#d8d8d4",
      printColorHex: "#1b1b1b",
      texture: "sunburst",
      indices: "applied",
      lume: "none",
      costEur: 35,
    }),
  ],
  hands: [
    hands({ id: "hands-mercedes-silver", name: "Mercedes Silver" }),
    hands({
      id: "hands-sword-silver",
      name: "Sword Silver",
      style: "sword",
      lengthsMm: { hour: 8, minute: 12, seconds: 12.8 },
      costEur: 10,
    }),
    hands({ id: "hands-mercedes-blue-lume", name: "Mercedes Blue Lume", lume: "blue" }),
    hands({
      id: "hands-gmt",
      name: "GMT Arrow",
      style: "arrow",
      holesMm: { hour: 1.5, minute: 0.9, seconds: 0.2, gmt: 2.2 },
      lengthsMm: { hour: 8.5, minute: 12.5, seconds: 13, gmt: 11 },
      includesGmt: true,
      gmtColorHex: "#c0392b",
      costEur: 18,
    }),
    hands({
      id: "hands-dauphine-dress",
      name: "Dauphine Dress",
      style: "dauphine",
      lengthsMm: { hour: 9, minute: 13.5, seconds: 14.2 },
      lume: "none",
      costEur: 14,
    }),
  ],
  crystals: [
    crystal({ id: "crystal-sapphire-315", name: "Sapphire flat 31.5mm" }),
    crystal({ id: "crystal-mineral-315", name: "Mineral flat 31.5mm", material: "mineral", arCoating: "none", costEur: 5 }),
    crystal({ id: "crystal-sapphire-300", name: "Sapphire flat 30mm", diameterMm: 30, costEur: 13 }),
    crystal({ id: "crystal-sapphire-320", name: "Sapphire domed 32mm", diameterMm: 32, shape: "domed", costEur: 16 }),
  ],
  bezelInserts: [
    insert({ id: "insert-dive-black", name: "Dive 60 Black" }),
    insert({ id: "insert-dive-blue", name: "Dive 60 Blue", colorHex: "#1d3a6b" }),
    insert({
      id: "insert-gmt-pepsi",
      name: "GMT 24 Pepsi",
      scale: "gmt-24",
      colorHex: "#b3202a",
      secondaryColorHex: "#1d3a6b",
      costEur: 12,
    }),
    insert({ id: "insert-dive-small", name: "Dive 60 Black 36mm", outerMm: 36, innerMm: 28.5, costEur: 7 }),
  ],
  straps: [
    strap({ id: "strap-rubber-black-22", name: "Black rubber 22mm" }),
    strap({ id: "strap-rubber-black-20", name: "Black rubber 20mm", widthMm: 20 }),
    strap({ id: "strap-nato-olive-20", name: "Olive NATO 20mm", type: "nato", widthMm: 20, colorHex: "#4b5320", costEur: 9 }),
    strap({ id: "strap-leather-brown-20", name: "Brown leather 20mm", type: "leather", widthMm: 20, colorHex: "#6b4226", costEur: 25 }),
    strap({ id: "strap-nato-black-22", name: "Black NATO 22mm", type: "nato", colorHex: "#1b1b1b", costEur: 9 }),
    strap({
      id: "strap-bracelet-diver-22",
      name: "Diver bracelet 22mm",
      type: "bracelet",
      colorHex: "#c9ccd1",
      compatibleCaseIds: ["case-diver"],
      costEur: 45,
    }),
  ],
};

/** A fresh copy each call, so a test can adjust one part's dimensions without affecting others. */
export function fixtureCatalog(): Catalog {
  return structuredClone(FIXTURE_CATALOG);
}

export function byId<T extends { id: string }>(parts: T[], id: string): T {
  const part = parts.find((p) => p.id === id);
  if (!part) throw new Error(`No fixture part ${id}`);
  return part;
}

export const BASE_SPEC: WatchSpec = {
  name: "Fixture diver",
  movementId: "mv-date",
  caseId: "case-diver",
  dialId: "dial-diver-black",
  handsId: "hands-mercedes-silver",
  crystalId: "crystal-sapphire-315",
  bezelInsertId: "insert-dive-black",
  strapId: "strap-rubber-black-22",
  personalization: { dialText: "", casebackEngraving: "" },
};

export function specWith(changes: Partial<WatchSpec>, personalization: Partial<Personalization> = {}): WatchSpec {
  return {
    ...BASE_SPEC,
    ...changes,
    personalization: { ...BASE_SPEC.personalization, ...changes.personalization, ...personalization },
  };
}

/** A buildable watch on the fixed-bezel field case (no insert). */
export const FIELD_SPEC: WatchSpec = {
  name: "Fixture field",
  movementId: "mv-date",
  caseId: "case-field",
  dialId: "dial-field-cream",
  handsId: "hands-mercedes-silver",
  crystalId: "crystal-sapphire-300",
  bezelInsertId: null,
  strapId: "strap-nato-olive-20",
  personalization: { dialText: "", casebackEngraving: "" },
};
