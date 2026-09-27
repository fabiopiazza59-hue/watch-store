// Test fixture: varied, fully resolved designs for the preview, independent of the real catalogue.
// Together they cover every crown position, bezel type, insert scale, index type, hand style,
// texture, date window and strap type the renderer draws.
import type { BezelInsert, Crystal, Dial, HandSet, Movement, ResolvedSpec, Strap, WatchCase } from "@/domain/types";

const sourcing = { description: "", costEur: 20, leadTimeDays: 7, supplierHint: "" };

function movement(part: Pick<Movement, "id" | "caliber" | "complications" | "dateDisplay">): Movement {
  return {
    ...sourcing,
    name: part.caliber,
    category: "movement",
    family: "NH3x",
    maker: "TMI",
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
    ...part,
  };
}

function watchCase(part: Pick<WatchCase, "id" | "style" | "diameterMm" | "lugToLugMm" | "lugWidthMm"> & Partial<WatchCase>): WatchCase {
  return {
    ...sourcing,
    name: part.id,
    category: "case",
    material: "316L steel",
    finish: "brushed & polished",
    movementFamily: "NH3x",
    thicknessMm: 13,
    crownPosition: 3,
    screwDownCrown: true,
    dialDiameterMm: 28.5,
    crystalDiameterMm: 30.5,
    bezel: "none",
    chapterRing: false,
    caseback: "solid",
    waterResistanceM: 100,
    handClearanceMm: 1.8,
    ...part,
  };
}

function dial(part: Pick<Dial, "id" | "style" | "colorHex" | "printColorHex" | "indices"> & Partial<Dial>): Dial {
  return {
    ...sourcing,
    name: part.id,
    category: "dial",
    movementFamily: "NH3x",
    diameterMm: 28.5,
    centerHoleMm: 2.05,
    crownPosition: 3,
    dateWindow: "none",
    texture: "matte",
    lume: "green",
    has24hScale: false,
    printable: true,
    ...part,
  };
}

function hands(part: Pick<HandSet, "id" | "style" | "colorHex"> & Partial<HandSet>): HandSet {
  return {
    ...sourcing,
    name: part.id,
    category: "hands",
    movementFamily: "NH3x",
    holesMm: { hour: 1.5, minute: 0.9, seconds: 0.2 },
    lengthsMm: { hour: 8.5, minute: 12.5, seconds: 13 },
    includesGmt: false,
    secondsColorHex: part.colorHex,
    lume: "green",
    ...part,
  };
}

function crystal(part: Pick<Crystal, "id" | "shape" | "diameterMm"> & Partial<Crystal>): Crystal {
  return {
    ...sourcing,
    name: part.id,
    category: "crystal",
    material: "sapphire",
    thicknessMm: 2.5,
    arCoating: "inner",
    ...part,
  };
}

function insert(part: Pick<BezelInsert, "id" | "scale" | "colorHex"> & Partial<BezelInsert>): BezelInsert {
  return {
    ...sourcing,
    name: part.id,
    category: "bezelInsert",
    material: "aluminium",
    outerMm: 38,
    innerMm: 30.6,
    printColorHex: "#f2f2ee",
    lumePip: true,
    ...part,
  };
}

function strap(part: Pick<Strap, "id" | "type" | "widthMm" | "colorHex">): Strap {
  return { ...sourcing, name: part.id, category: "strap", ...part };
}

const nh35 = movement({ id: "mv-nh35", caliber: "NH35A", complications: ["date"], dateDisplay: "date-3" });
const nh36 = movement({ id: "mv-nh36", caliber: "NH36A", complications: ["date", "day"], dateDisplay: "day-date-3" });
const nh34 = movement({ id: "mv-nh34", caliber: "NH34A", complications: ["date", "gmt"], dateDisplay: "date-3" });
const nh38 = movement({ id: "mv-nh38", caliber: "NH38A", complications: [], dateDisplay: "none" });

export interface PreviewFixture {
  name: string;
  parts: ResolvedSpec;
  dialText: string;
}

export const PREVIEW_FIXTURES: PreviewFixture[] = [
  {
    name: "Diver, 3.8 crown, dive insert",
    dialText: "",
    parts: {
      movement: nh35,
      case: watchCase({
        id: "case-diver-42",
        style: "diver",
        diameterMm: 42,
        lugToLugMm: 46,
        lugWidthMm: 22,
        crownPosition: 3.8,
        crystalDiameterMm: 31.5,
        bezel: "unidirectional-120",
        insertMm: { outer: 38, inner: 30.6 },
        chapterRing: true,
        waterResistanceM: 200,
      }),
      dial: dial({
        id: "dial-diver-black",
        style: "diver",
        crownPosition: 3.8,
        dateWindow: "date-3",
        colorHex: "#15171a",
        printColorHex: "#f2f2ee",
        indices: "printed",
      }),
      hands: hands({ id: "hands-mercedes", style: "mercedes", colorHex: "#d9dde2" }),
      crystal: crystal({ id: "crystal-flat-315", shape: "flat", diameterMm: 31.5 }),
      bezelInsert: insert({ id: "insert-dive-black", scale: "dive-60", colorHex: "#16181b" }),
      strap: strap({ id: "strap-rubber-22", type: "rubber", widthMm: 22, colorHex: "#1b1b1b" }),
    },
  },
  {
    name: "Field, no bezel, Arabic numerals",
    dialText: "Grandpa's watch",
    parts: {
      movement: nh38,
      case: watchCase({
        id: "case-field-38",
        style: "field",
        finish: "brushed",
        diameterMm: 38,
        lugToLugMm: 45,
        lugWidthMm: 20,
        crystalDiameterMm: 29.5,
      }),
      dial: dial({
        id: "dial-field-cream",
        style: "field",
        colorHex: "#efe6d2",
        printColorHex: "#2a2a2a",
        indices: "arabic",
        lume: "vintage",
      }),
      hands: hands({
        id: "hands-cathedral",
        style: "cathedral",
        colorHex: "#23395d",
        lume: "vintage",
        lengthsMm: { hour: 8, minute: 11.5, seconds: 12.5 },
      }),
      crystal: crystal({ id: "crystal-flat-295", shape: "flat", diameterMm: 29.5 }),
      strap: strap({ id: "strap-canvas-20", type: "canvas", widthMm: 20, colorHex: "#a89a73" }),
    },
  },
  {
    name: "Dress, Roman, domed, display back",
    dialText: "Anna & Tom",
    parts: {
      movement: nh35,
      case: watchCase({
        id: "case-dress-39",
        style: "dress",
        finish: "polished",
        diameterMm: 39,
        lugToLugMm: 46,
        lugWidthMm: 20,
        screwDownCrown: false,
        crystalDiameterMm: 29.5,
        chapterRing: true,
        caseback: "display",
      }),
      dial: dial({
        id: "dial-dress-ivory",
        style: "dress",
        dateWindow: "date-3",
        colorHex: "#f3ecdc",
        printColorHex: "#1b1b1b",
        texture: "gloss",
        indices: "roman",
        lume: "none",
      }),
      hands: hands({
        id: "hands-dauphine",
        style: "dauphine",
        colorHex: "#e3e5e8",
        lume: "none",
        lengthsMm: { hour: 8, minute: 12, seconds: 12.5 },
      }),
      crystal: crystal({ id: "crystal-dd-295", shape: "double-dome", diameterMm: 29.5, arCoating: "both" }),
      strap: strap({ id: "strap-leather-black-20", type: "leather", widthMm: 20, colorHex: "#1a1a1a" }),
    },
  },
  {
    name: "Pilot, arrow hands, wide dial",
    dialText: "",
    parts: {
      movement: nh38,
      case: watchCase({
        id: "case-pilot-39",
        style: "pilot",
        finish: "bead-blasted",
        diameterMm: 39,
        lugToLugMm: 48.5,
        lugWidthMm: 20,
        dialDiameterMm: 33.5,
        crystalDiameterMm: 34.5,
      }),
      dial: dial({
        id: "dial-pilot-black",
        style: "pilot",
        diameterMm: 33.5,
        colorHex: "#141414",
        printColorHex: "#f5f5f0",
        indices: "arabic",
      }),
      hands: hands({
        id: "hands-arrow-large",
        style: "arrow",
        colorHex: "#f1f1ec",
        lengthsMm: { hour: 10.5, minute: 15, seconds: 16 },
      }),
      crystal: crystal({ id: "crystal-flat-345", shape: "flat", diameterMm: 34.5 }),
      strap: strap({ id: "strap-leather-tan-20", type: "leather", widthMm: 20, colorHex: "#9a6a3f" }),
    },
  },
  {
    name: "GMT, two-tone 24h bezel, 24h dial",
    dialText: "Home & away",
    parts: {
      movement: nh34,
      case: watchCase({
        id: "case-gmt-40",
        style: "gmt",
        diameterMm: 40,
        lugToLugMm: 47.5,
        lugWidthMm: 20,
        bezel: "bidirectional-24h",
        insertMm: { outer: 38, inner: 30.6 },
        chapterRing: true,
        waterResistanceM: 200,
      }),
      dial: dial({
        id: "dial-gmt-black",
        style: "gmt",
        dateWindow: "date-3",
        colorHex: "#16181b",
        printColorHex: "#f2f2ee",
        indices: "printed",
        has24hScale: true,
        centerHoleMm: 2.8,
      }),
      hands: hands({
        id: "hands-gmt-mercedes",
        style: "mercedes",
        colorHex: "#d9dde2",
        includesGmt: true,
        gmtColorHex: "#c8372d",
        holesMm: { hour: 1.5, minute: 0.9, seconds: 0.2, gmt: 2.2 },
        lengthsMm: { hour: 8.5, minute: 12.5, seconds: 13, gmt: 12 },
      }),
      crystal: crystal({ id: "crystal-flat-305", shape: "flat", diameterMm: 30.5 }),
      bezelInsert: insert({
        id: "insert-gmt-blue-red",
        scale: "gmt-24",
        colorHex: "#1f3f7a",
        secondaryColorHex: "#a8262c",
      }),
      strap: strap({ id: "strap-bracelet-20", type: "bracelet", widthMm: 20, colorHex: "#cfd2d6" }),
    },
  },
  {
    name: "Bronze diver, day-date, ceramic insert",
    dialText: "",
    parts: {
      movement: nh36,
      case: watchCase({
        id: "case-diver-bronze-40",
        style: "diver",
        material: "bronze",
        finish: "brushed",
        diameterMm: 40,
        lugToLugMm: 47.2,
        lugWidthMm: 20,
        bezel: "unidirectional-120",
        insertMm: { outer: 38, inner: 30.6 },
        chapterRing: true,
        waterResistanceM: 200,
      }),
      dial: dial({
        id: "dial-diver-green-daydate",
        style: "diver",
        dateWindow: "day-date-3",
        colorHex: "#2f4a34",
        printColorHex: "#efe6d2",
        texture: "sunburst",
        indices: "applied",
        lume: "vintage",
      }),
      hands: hands({
        id: "hands-snowflake-gilt",
        style: "snowflake",
        colorHex: "#c9a45c",
        lume: "vintage",
        lengthsMm: { hour: 8.5, minute: 12, seconds: 12.5 },
      }),
      crystal: crystal({ id: "crystal-domed-305", shape: "domed", diameterMm: 30.5 }),
      bezelInsert: insert({ id: "insert-dive-ceramic", scale: "dive-60", material: "ceramic", colorHex: "#2a2622", printColorHex: "#c9a45c" }),
      strap: strap({ id: "strap-leather-brown-20", type: "leather", widthMm: 20, colorHex: "#6b4226" }),
    },
  },
  {
    name: "Black PVD sport, day-date, grained",
    dialText: "Night shift",
    parts: {
      movement: nh36,
      case: watchCase({
        id: "case-sport-pvd-42",
        style: "sport",
        finish: "PVD black",
        diameterMm: 42,
        lugToLugMm: 46,
        lugWidthMm: 22,
        crownPosition: 3.8,
        crystalDiameterMm: 31.5,
        bezel: "fixed",
        chapterRing: true,
      }),
      dial: dial({
        id: "dial-sport-graphite",
        style: "sport",
        crownPosition: 3.8,
        dateWindow: "day-date-3",
        colorHex: "#2b2e33",
        printColorHex: "#e9ebe6",
        texture: "grained",
        indices: "arabic",
      }),
      hands: hands({ id: "hands-baton-black", style: "baton", colorHex: "#26282b", secondsColorHex: "#e0662a" }),
      crystal: crystal({ id: "crystal-flat-315", shape: "flat", diameterMm: 31.5 }),
      strap: strap({ id: "strap-nato-navy-22", type: "nato", widthMm: 22, colorHex: "#1f2c44" }),
    },
  },
  {
    name: "Titanium field, countdown, syringe",
    dialText: "",
    parts: {
      movement: nh35,
      case: watchCase({
        id: "case-ti-40",
        style: "field",
        material: "titanium",
        finish: "bead-blasted",
        diameterMm: 40,
        lugToLugMm: 47,
        lugWidthMm: 20,
        crownPosition: 4,
        bezel: "unidirectional-120",
        insertMm: { outer: 38, inner: 30.6 },
      }),
      dial: dial({
        id: "dial-teal-sunburst",
        style: "field",
        crownPosition: 4,
        dateWindow: "date-3",
        colorHex: "#1f5f63",
        printColorHex: "#f2f2ee",
        texture: "sunburst",
        indices: "applied",
      }),
      hands: hands({
        id: "hands-syringe",
        style: "syringe",
        colorHex: "#f1f1ec",
        secondsColorHex: "#c8372d",
      }),
      crystal: crystal({ id: "crystal-mineral-305", shape: "flat", diameterMm: 30.5, material: "mineral", arCoating: "none" }),
      bezelInsert: insert({ id: "insert-countdown-grey", scale: "countdown-60", colorHex: "#5b6068" }),
      strap: strap({ id: "strap-nato-olive-20", type: "nato", widthMm: 20, colorHex: "#4b5320" }),
    },
  },
  {
    name: "Silver dress, applied batons, sword hands",
    dialText: "",
    parts: {
      movement: nh38,
      case: watchCase({
        id: "case-dress-fixed-38",
        style: "dress",
        finish: "polished",
        diameterMm: 38,
        lugToLugMm: 45,
        lugWidthMm: 20,
        screwDownCrown: false,
        crystalDiameterMm: 29.5,
        bezel: "fixed",
      }),
      dial: dial({
        id: "dial-dress-silver",
        style: "dress",
        colorHex: "#d6d8d9",
        printColorHex: "#2b2b2b",
        texture: "sunburst",
        indices: "applied",
        lume: "none",
      }),
      hands: hands({ id: "hands-sword-silver", style: "sword", colorHex: "#d4d7db", secondsColorHex: "#c8372d", lume: "none" }),
      crystal: crystal({ id: "crystal-domed-295", shape: "domed", diameterMm: 29.5 }),
      strap: strap({ id: "strap-bracelet-ti-20", type: "bracelet", widthMm: 20, colorHex: "#a9acae" }),
    },
  },
];
