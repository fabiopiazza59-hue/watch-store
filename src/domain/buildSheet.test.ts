import { describe, expect, it } from "vitest";
import {
  BENCH_MINUTES,
  createBuildSheet,
  estimateBenchMinutes,
  PERSONALIZATION_SERVICES,
} from "./buildSheet";
import { CATALOG, resolveSpec, TEMPLATES } from "./catalog";
import type { BuildSheet, Catalog, WatchSpec } from "./types";

// Real catalogue parts with every field the build sheet branches on pinned, so these tests don't move
// with the catalogue.
function fixtureCatalog(): Catalog {
  const [movement] = CATALOG.movements;
  const [watchCase] = CATALOG.cases;
  const [dial] = CATALOG.dials;
  const [hands] = CATALOG.hands;
  const [insert] = CATALOG.bezelInserts;
  const [strap] = CATALOG.straps;
  const nh3x = {
    ...movement,
    hasDateWheel: true,
    hacking: true,
    handWinding: true,
    beatRateVph: 21600,
    powerReserveHours: 41,
    handHolesMm: { hour: 1.5, minute: 0.89, seconds: 0.21 },
    accuracySecPerDay: { min: -15, max: 35 },
    dataNotes: undefined,
  };
  return {
    movements: [
      { ...nh3x, id: "mv-date", name: "Test NH35", caliber: "NH35A", complications: ["date"], dateDisplay: "date-3" },
      { ...nh3x, id: "mv-daydate", name: "Test NH36", caliber: "NH36A", complications: ["date", "day"], dateDisplay: "day-date-3" },
      {
        ...nh3x,
        id: "mv-gmt",
        name: "Test NH34",
        caliber: "NH34A",
        complications: ["date", "gmt"],
        dateDisplay: "date-3",
        handHolesMm: { hour: 1.5, minute: 0.89, seconds: 0.21, gmt: 2.2 },
        dataNotes: "Caller GMT: the 24h hand is set on its own.",
      },
      {
        ...nh3x,
        id: "mv-nodate",
        name: "Test NH38",
        caliber: "NH38A",
        complications: [],
        dateDisplay: "none",
        hasDateWheel: false,
      },
    ],
    cases: [
      {
        ...watchCase,
        id: "case-diver",
        name: "Test Diver",
        bezel: "unidirectional-120",
        insertMm: { outer: 38, inner: 30.6 },
        chapterRing: true,
        caseback: "solid",
        screwDownCrown: true,
        crownPosition: 3.8,
        waterResistanceM: 300,
        handClearanceMm: 1.8,
        finish: "brushed & polished",
        dataNotes: "Crystal seat is an estimate.",
      },
      {
        ...watchCase,
        id: "case-gmt",
        name: "Test GMT",
        bezel: "bidirectional-24h",
        insertMm: { outer: 38, inner: 30.6 },
        caseback: "solid",
        screwDownCrown: true,
        crownPosition: 3,
        waterResistanceM: 200,
        handClearanceMm: 1.7,
        dataNotes: undefined,
      },
      {
        ...watchCase,
        id: "case-dress",
        name: "Test Dress",
        bezel: "none",
        insertMm: undefined,
        chapterRing: false,
        caseback: "display",
        screwDownCrown: false,
        crownPosition: 3,
        waterResistanceM: 50,
        finish: "polished",
        dataNotes: undefined,
      },
    ],
    dials: [
      { ...dial, id: "dial-date", name: "Test Date", dateWindow: "date-3", has24hScale: false, lume: "green", dataNotes: undefined },
      { ...dial, id: "dial-daydate", name: "Test Day-Date", dateWindow: "day-date-3", has24hScale: false, dataNotes: undefined },
      { ...dial, id: "dial-nodate", name: "Test No-Date", dateWindow: "none", has24hScale: false, lume: "none", dataNotes: undefined },
      { ...dial, id: "dial-gmt", name: "Test GMT Dial", dateWindow: "date-3", has24hScale: true, centerHoleMm: 2.8, dataNotes: undefined },
    ],
    hands: [
      { ...hands, id: "hands", name: "Test Hands", includesGmt: false, lume: "green", dataNotes: undefined },
      { ...hands, id: "hands-plain", name: "Test Plain Hands", includesGmt: false, lume: "none", dataNotes: undefined },
      {
        ...hands,
        id: "hands-gmt",
        name: "Test GMT Hands",
        includesGmt: true,
        holesMm: { hour: 1.5, minute: 0.9, seconds: 0.2, gmt: 2.2 },
        dataNotes: undefined,
      },
    ],
    crystals: [{ ...CATALOG.crystals[0], id: "crystal", name: "Test Crystal", arCoating: "inner", dataNotes: undefined }],
    bezelInserts: [
      { ...insert, id: "insert-dive", name: "Test Dive Insert", scale: "dive-60", material: "aluminium", outerMm: 38, innerMm: 30.6, dataNotes: undefined },
      { ...insert, id: "insert-gmt", name: "Test GMT Insert", scale: "gmt-24", material: "ceramic", outerMm: 38, innerMm: 30.6, dataNotes: undefined },
    ],
    straps: [
      { ...strap, id: "strap-rubber", name: "Test Rubber", type: "rubber", compatibleCaseIds: undefined, dataNotes: undefined },
      { ...strap, id: "strap-nato", name: "Test NATO", type: "nato", compatibleCaseIds: undefined, dataNotes: undefined },
      { ...strap, id: "bracelet", name: "Test Bracelet", type: "bracelet", compatibleCaseIds: ["case-diver"], dataNotes: undefined },
    ],
  };
}

const DIVER: WatchSpec = {
  name: "Test Diver",
  movementId: "mv-date",
  caseId: "case-diver",
  dialId: "dial-date",
  handsId: "hands",
  crystalId: "crystal",
  bezelInsertId: "insert-dive",
  strapId: "strap-rubber",
  personalization: { dialText: "", casebackEngraving: "" },
};
const GMT: WatchSpec = {
  ...DIVER,
  name: "Test GMT",
  movementId: "mv-gmt",
  caseId: "case-gmt",
  dialId: "dial-gmt",
  handsId: "hands-gmt",
  bezelInsertId: "insert-gmt",
};
const DRESS: WatchSpec = {
  ...DIVER,
  name: "Test Dress",
  caseId: "case-dress",
  dialId: "dial-nodate",
  movementId: "mv-nodate",
  handsId: "hands-plain",
  bezelInsertId: null,
  strapId: "strap-nato",
};

function sheet(spec: WatchSpec): BuildSheet {
  return createBuildSheet(spec, fixtureCatalog());
}

function step(result: BuildSheet, title: string) {
  return result.steps.find((s) => s.title === title);
}

function qc(result: BuildSheet, id: string) {
  return result.qcChecks.find((check) => check.id === id);
}

/** Every piece of prose on the sheet, for "is it mentioned anywhere" assertions. */
function allText(result: BuildSheet): string {
  return [
    result.title,
    result.summary,
    ...result.tools,
    ...result.steps.flatMap((s) => [s.title, s.detail, ...s.cautions]),
    ...result.qcChecks.flatMap((check) => [check.label, check.criterion]),
    ...result.notes,
  ].join("\n");
}

describe("createBuildSheet", () => {
  it.each<[string, WatchSpec]>([
    ["diver", DIVER],
    ["GMT", GMT],
    ["dress", DRESS],
    ["day-date", { ...DIVER, movementId: "mv-daydate", dialId: "dial-daydate" }],
    ["personalized", { ...DIVER, personalization: { dialText: "Est. 2026", casebackEngraving: "For Anna" } }],
    ["broken", { ...DIVER, dialId: "nope", strapId: "" }],
  ])("writes complete, placeholder-free text for the %s build", (_, spec) => {
    const result = sheet(spec);
    expect(result.title).toBe(`Build sheet: ${spec.name}`);
    for (const s of result.steps) {
      expect(s.title).not.toBe("");
      expect(s.detail).not.toBe("");
    }
    expect(allText(result)).not.toMatch(/undefined|NaN|null|\[object/);
    expect(new Set(result.qcChecks.map((check) => check.id)).size).toBe(result.qcChecks.length);
  });

  it("produces a complete sheet for every design template", () => {
    for (const template of TEMPLATES) {
      const result = createBuildSheet(template.spec);
      expect(result.bom.length).toBeGreaterThanOrEqual(6);
      expect(result.steps.length).toBeGreaterThanOrEqual(12);
      expect(allText(result)).not.toMatch(/undefined|NaN/);
    }
  });
});

describe("bill of materials", () => {
  it("lists every chosen part in build order with its cost and supplier hint", () => {
    const catalog = fixtureCatalog();
    const result = createBuildSheet(DIVER, catalog);
    expect(result.bom.map((line) => line.slot)).toEqual([
      "caseId",
      "movementId",
      "dialId",
      "handsId",
      "bezelInsertId",
      "crystalId",
      "strapId",
    ]);
    const caseLine = result.bom.find((line) => line.slot === "caseId");
    expect(caseLine).toEqual({
      slot: "caseId",
      partId: "case-diver",
      name: "Test Diver",
      qty: 1,
      unitCostEur: catalog.cases[0].costEur,
      supplierHint: catalog.cases[0].supplierHint,
    });
  });

  it("leaves out an empty insert slot", () => {
    expect(sheet(DRESS).bom.map((line) => line.slot)).not.toContain("bezelInsertId");
  });

  it("adds a line per personalization service", () => {
    const result = sheet({ ...DIVER, personalization: { dialText: "Est. 2026", casebackEngraving: "For Anna" } });
    expect(result.bom.filter((line) => line.slot === "personalization")).toEqual([
      {
        slot: "personalization",
        partId: null,
        name: `${PERSONALIZATION_SERVICES.dialText.label}: "Est. 2026"`,
        qty: 1,
        unitCostEur: PERSONALIZATION_SERVICES.dialText.costEur,
        supplierHint: PERSONALIZATION_SERVICES.dialText.supplierHint,
      },
      {
        slot: "personalization",
        partId: null,
        name: `${PERSONALIZATION_SERVICES.casebackEngraving.label}: "For Anna"`,
        qty: 1,
        unitCostEur: PERSONALIZATION_SERVICES.casebackEngraving.costEur,
        supplierHint: PERSONALIZATION_SERVICES.casebackEngraving.supplierHint,
      },
    ]);
  });
});

describe("steps follow the actual parts", () => {
  it("fits the 24h hand first, only on a GMT", () => {
    const gmt = sheet(GMT);
    const hands = step(gmt, "Fit the four hands");
    expect(hands?.detail).toMatch(/Press the 24h hand first: it has the largest hole \(2\.2mm\)/);
    expect(hands?.detail.indexOf("24h hand")).toBeLessThan(hands?.detail.indexOf("hour hand at 12") ?? 0);
    expect(hands?.cautions.join(" ")).toContain("estimated 1.7mm");
    expect(step(gmt, "Check clearances and the calendar before casing")?.detail).toContain("24h hand should jump one hour");
    expect(step(gmt, "Check the parts in against this sheet")?.detail).toContain("dial's centre hole: it should be about 2.8mm");

    const diver = sheet(DIVER);
    expect(step(diver, "Fit the hands")).toBeDefined();
    expect(allText(diver)).not.toMatch(/24h hand|GMT/);
  });

  it("covers the day wheel and Seiko's day-date quick-set window only for day-date builds", () => {
    const dayDate = sheet({ ...DIVER, movementId: "mv-daydate", dialId: "dial-daydate" });
    expect(step(dayDate, "Fit the dial")?.detail).toContain("day-wheel variant");
    expect(allText(dayDate)).toContain("between 9 p.m. and 4 a.m.");
    expect(step(dayDate, "Set the watch and fit the strap")?.detail).toContain("clockwise sets the day");

    const date = sheet(DIVER);
    expect(allText(date)).toContain("between 9 p.m. and 1 a.m.");
    expect(allText(date)).not.toContain("day-wheel");
    expect(allText(sheet(GMT))).toContain("between 9 p.m. and 3 a.m.");
  });

  it("explains the phantom date for a no-date dial on a date movement", () => {
    const result = sheet({ ...DIVER, dialId: "dial-nodate" });
    expect(result.notes.some((note) => note.startsWith("Phantom date: the NH35A has a date wheel"))).toBe(true);
    expect(step(result, "Fit the dial")?.detail).toContain("date disc is hidden");
    expect(qc(result, "qc-date-change")).toBeUndefined();
  });

  it("has no phantom date or calendar steps on a true no-date movement", () => {
    const result = sheet(DRESS);
    expect(allText(result)).not.toMatch(/Phantom date|quick-set/);
    expect(step(result, "Fit the hands")?.detail).toContain("NH38A has no date to time against");
    expect(step(result, "Check hand clearances before casing")).toBeDefined();
    expect(qc(result, "qc-date-change")).toBeUndefined();
  });

  it("fits a bezel insert only when there is one, aligned to its own scale", () => {
    const dive = step(sheet(DIVER), "Fit the bezel insert");
    expect(dive?.detail).toContain("(38 x 30.6mm) so its 12 o'clock marker lines up with 12 on the chapter ring");
    expect(dive?.cautions.join(" ")).not.toContain("Ceramic");

    const gmt = step(sheet(GMT), "Fit the bezel insert");
    expect(gmt?.detail).toContain("its 24 marker");
    expect(gmt?.cautions.join(" ")).toContain("Ceramic is brittle");

    expect(step(sheet(DRESS), "Fit the bezel insert")).toBeUndefined();
  });

  it("treats display and solid casebacks differently", () => {
    const dress = sheet(DRESS);
    expect(step(dress, "Close the display caseback")?.detail).toContain("on show for good");
    expect(qc(dress, "qc-dust")?.criterion).toContain("display caseback");

    const diver = sheet(DIVER);
    expect(step(diver, "Close the caseback")).toBeDefined();
    expect(qc(diver, "qc-dust")?.criterion).not.toContain("display caseback");
  });

  it("uses screw-down or push-pull crown instructions to match the case", () => {
    const diver = sheet(DIVER);
    expect(step(diver, "Cut the stem and fit the screw-down crown")?.detail).toContain("a thread or two to spare");
    expect(qc(diver, "qc-crown")?.criterion).toMatch(/^Screws fully down/);

    const dress = sheet(DRESS);
    expect(step(dress, "Cut the stem and fit the crown")?.detail).toContain("just clear of the end of the tube");
    expect(qc(dress, "qc-crown")?.criterion).toMatch(/^Sits just clear of the tube/);
  });

  it("starts with the personalization jobs, which need their parts before anything else", () => {
    const result = sheet({ ...DIVER, personalization: { dialText: "Est. 2026", casebackEngraving: "For Anna" } });
    expect(result.steps[0].title).toBe("Personalization first: UV-print the dial");
    expect(result.steps[0].detail).toContain('"Est. 2026"');
    expect(result.steps[1].title).toBe("Personalization first: engrave the caseback");
    expect(result.steps[1].detail).toContain('"For Anna"');
    expect(qc(result, "qc-dial-text")?.criterion).toContain('Reads exactly "Est. 2026"');
    expect(qc(result, "qc-engraving")?.criterion).toContain('Reads exactly "For Anna"');

    const plain = sheet(DIVER);
    expect(plain.steps[0].title).toBe("Check the parts in against this sheet");
    expect(qc(plain, "qc-dial-text")).toBeUndefined();
  });

  it("sizes a bracelet and threads a NATO", () => {
    const bracelet = sheet({ ...DIVER, strapId: "bracelet" });
    const setStep = step(bracelet, "Size the bracelet and set the watch");
    expect(setStep?.detail).toContain("Take links out");
    expect(setStep?.detail).toContain("solid end links");
    expect(bracelet.tools.some((tool) => tool.startsWith("Bracelet link tool"))).toBe(true);

    const nato = sheet(DRESS);
    expect(step(nato, "Set the watch and fit the strap")?.detail).toContain("thread the NATO");
    expect(nato.tools.some((tool) => tool.startsWith("Bracelet link tool"))).toBe(false);
  });
});

describe("QC criteria come from the parts' data", () => {
  it("uses the movement's accuracy spec and the case's water resistance", () => {
    const result = sheet(DIVER);
    expect(qc(result, "qc-rate")?.criterion).toMatch(/^-15 to \+35 s\/day/);
    expect(qc(result, "qc-run-in")?.criterion).toContain("reserve 41 h");
    expect(qc(result, "qc-water")?.criterion).toMatch(/^No leak at 30 bar \(the case's 300m rating\)/);
    expect(result.tools).toContain("Pressure tester (the case is rated 30 bar)");
    expect(result.tools).toContain("Timegrapher (21,600 vph, lift angle 53°)");
  });

  it("checks the bezel action for the case's bezel", () => {
    expect(qc(sheet(DIVER), "qc-bezel")?.criterion).toContain("exactly 120 clicks per full turn");
    expect(qc(sheet(GMT), "qc-bezel")?.criterion).toContain("24 rests exactly over 12");
    expect(qc(sheet(DRESS), "qc-bezel")).toBeUndefined();
  });

  it("checks the date change, the day and the GMT hand only where they exist", () => {
    expect(qc(sheet(DIVER), "qc-date-change")?.criterion).toContain("snaps over at midnight");
    expect(qc(sheet({ ...DIVER, movementId: "mv-daydate", dialId: "dial-daydate" }), "qc-date-change")?.criterion).toContain(
      "about 4 a.m.",
    );
    expect(qc(sheet(GMT), "qc-gmt")?.criterion).toContain("dial's 24h scale");
    expect(qc(sheet(DIVER), "qc-gmt")).toBeUndefined();
  });

  it("checks the lume only when the dial or hands are lumed", () => {
    expect(qc(sheet(DIVER), "qc-lume")).toBeDefined();
    expect(qc(sheet(DRESS), "qc-lume")).toBeUndefined();
  });
});

describe("notes", () => {
  it("carry every part's data notes, named", () => {
    const result = sheet(GMT);
    expect(result.notes).toContain("Test NH34: Caller GMT: the 24h hand is set on its own.");
    expect(sheet(DIVER).notes).toContain("Test Diver: Crystal seat is an estimate.");
  });

  it("flag missing parts instead of throwing", () => {
    const result = sheet({ ...DIVER, dialId: "nope", strapId: "" });
    expect(result.notes[0]).toBe(
      "Not buildable as specified: dial 'nope' is not in the catalogue; no strap chosen. Check the design's validation report.",
    );
    expect(result.bom.map((line) => line.slot)).not.toContain("dialId");
    expect(step(result, "Fit the dial")).toBeUndefined();
  });
});

describe("estimateBenchMinutes", () => {
  const catalog = fixtureCatalog();
  const minutes = (spec: WatchSpec) => estimateBenchMinutes(resolveSpec(spec, catalog), spec.personalization);

  it("adds time for a GMT hand, an insert, each personalization and bracelet sizing", () => {
    expect(minutes(DRESS)).toBe(BENCH_MINUTES.base);
    expect(minutes(DIVER)).toBe(BENCH_MINUTES.base + BENCH_MINUTES.bezelInsert);
    expect(minutes(GMT)).toBe(BENCH_MINUTES.base + BENCH_MINUTES.gmtHand + BENCH_MINUTES.bezelInsert);
    expect(minutes({ ...DRESS, strapId: "bracelet" })).toBe(BENCH_MINUTES.base + BENCH_MINUTES.braceletSizing);
    expect(minutes({ ...DRESS, personalization: { dialText: "Est. 2026", casebackEngraving: " For Anna " } })).toBe(
      BENCH_MINUTES.base + 2 * BENCH_MINUTES.perPersonalization,
    );
  });

  it("is the number the build sheet reports", () => {
    const result = sheet(GMT);
    expect(result.estimatedBenchMinutes).toBe(minutes(GMT));
    expect(result.summary).toContain(`About 2 h 5 min at the bench`);
  });
});
