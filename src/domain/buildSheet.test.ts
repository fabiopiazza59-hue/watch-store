import { describe, expect, it } from "vitest";
import {
  BENCH_MINUTES,
  createBuildSheet,
  estimateBenchMinutes,
  PERSONALIZATION_SERVICES,
} from "./buildSheet";
import { CATALOG, resolveSpec, TEMPLATES } from "./catalog";
import type { BuildSheet, Catalog, WatchSpec } from "./types";

const DARK = "#15171a";
const LIGHT = "#efe6d2";

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
        waterResistanceEstimated: undefined,
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
        waterResistanceEstimated: undefined,
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
        waterResistanceEstimated: true,
        finish: "polished",
        dataNotes: undefined,
      },
    ],
    dials: [
      { ...dial, id: "dial-date", name: "Test Date", dateWindow: "date-3", colorHex: DARK, has24hScale: false, lume: "green", dataNotes: undefined },
      { ...dial, id: "dial-date-light", name: "Test Light Date", dateWindow: "date-3", colorHex: LIGHT, has24hScale: false, dataNotes: undefined },
      { ...dial, id: "dial-daydate", name: "Test Day-Date", dateWindow: "day-date-3", colorHex: DARK, has24hScale: false, dataNotes: undefined },
      { ...dial, id: "dial-nodate", name: "Test No-Date", dateWindow: "none", colorHex: LIGHT, has24hScale: false, lume: "none", dataNotes: undefined },
      { ...dial, id: "dial-gmt", name: "Test GMT Dial", dateWindow: "date-3", colorHex: DARK, has24hScale: true, centerHoleMm: 2.8, dataNotes: undefined },
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
    crystals: [
      { ...CATALOG.crystals[0], id: "crystal", name: "Test Crystal", shape: "flat", arCoating: "inner", dataNotes: undefined },
      { ...CATALOG.crystals[0], id: "crystal-domed", name: "Test Domed Crystal", shape: "double-dome", arCoating: "both", dataNotes: undefined },
    ],
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

  it("pressure-tests the Gilt Compact Diver at its maker's 5 bar, not above", () => {
    const template = TEMPLATES.find((t) => t.id === "tpl-gilt-compact-diver");
    const result = createBuildSheet(template!.spec);
    expect(step(result, "Pressure test")?.detail).toContain("dry-test it at 5 bar");
    expect(step(result, "Pressure test")?.cautions.join(" ")).toContain("hasn't confirmed the 50m rating");
    expect(qc(result, "qc-water")?.criterion).toMatch(/^No leak when tested at 5 bar/);
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

  it("treats an empty insert id as no insert, not as a missing part", () => {
    const result = sheet({ ...DRESS, bezelInsertId: "" });
    expect(result.bom.map((line) => line.slot)).not.toContain("bezelInsertId");
    expect(result.notes.some((note) => note.startsWith("Not buildable"))).toBe(false);
  });

  it("names the date wheel colour and, for a day-date, the day wheel for the case's crown", () => {
    const movementLine = (spec: WatchSpec) => sheet(spec).bom.find((line) => line.slot === "movementId")?.name;
    expect(movementLine(DIVER)).toBe("Test NH35, with a black date wheel");
    expect(movementLine({ ...DIVER, dialId: "dial-date-light" })).toBe("Test NH35, with a white date wheel");
    expect(movementLine({ ...DIVER, dialId: "dial-nodate" })).toBe("Test NH35");
    expect(movementLine(DRESS)).toBe("Test NH38");

    const dayDate = { ...DIVER, movementId: "mv-daydate", dialId: "dial-daydate" };
    expect(movementLine(dayDate)).toContain("black day and date wheels");
    expect(movementLine(dayDate)).toContain("'4 o'clock crown' day wheel");
    expect(movementLine({ ...dayDate, caseId: "case-gmt" })).toContain("the standard day wheel (for a 3 o'clock crown)");
    expect(step(sheet(dayDate), "Check the parts in against this sheet")?.detail).toContain(
      "Check the NH36A came with black day and date wheels and the '4 o'clock crown' day wheel",
    );
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
    const beforeCasing = step(gmt, "Check clearances and the calendar before casing");
    expect(beforeCasing?.detail).toContain("24h hand should jump one hour");
    expect(step(gmt, "Check the parts in against this sheet")?.detail).toContain("dial's centre hole: it should be about 2.8mm");

    const diver = sheet(DIVER);
    expect(step(diver, "Fit the hands")).toBeDefined();
    expect(allText(diver)).not.toMatch(/24h hand|GMT/);
  });

  it("tests the 24h-hand quick-set at 6 o'clock, outside the NH34's no-quick-set window", () => {
    const beforeCasing = step(sheet(GMT), "Check clearances and the calendar before casing");
    const detail = beforeCasing?.detail ?? "";
    expect(detail.indexOf("turn the hands on to about 6 o'clock")).toBeGreaterThan(-1);
    expect(detail.indexOf("6 o'clock")).toBeLessThan(detail.indexOf("first position"));
    expect(beforeCasing?.cautions.join(" ")).toContain("Never use the date or 24h-hand quick-set between 9 p.m. and 3 a.m.");
    expect(step(sheet(DIVER), "Check clearances and the calendar before casing")?.cautions.join(" ")).toContain(
      "Never use the calendar quick-set",
    );
  });

  it("uses the quick-set window from the movement maker's guide for each calibre", () => {
    const dayDate = sheet({ ...DIVER, movementId: "mv-daydate", dialId: "dial-daydate" });
    expect(step(dayDate, "Fit the dial")?.detail).toContain("day-wheel variant");
    expect(allText(dayDate)).toContain("between 9 p.m. and 4 a.m.");
    expect(step(dayDate, "Set the watch and fit the strap")?.detail).toContain("clockwise sets the day");

    const date = sheet(DIVER);
    expect(allText(date)).toContain("between 9 p.m. and 4 a.m. (SII's NH3 technical guide)");
    expect(allText(date)).not.toContain("day-wheel");
    expect(allText(sheet(GMT))).toContain("between 9 p.m. and 3 a.m.");
  });

  it("explains the phantom date and finds midnight before the dial hides the date", () => {
    const result = sheet({ ...DIVER, dialId: "dial-nodate" });
    expect(result.notes.some((note) => note.startsWith("Phantom date: the NH35A has a date wheel"))).toBe(true);
    const dial = step(result, "Fit the dial")?.detail ?? "";
    expect(dial).toContain("date disc will be hidden");
    expect(dial.indexOf("until the date just snaps over")).toBeLessThan(dial.indexOf("Line the feet up"));
    const hands = step(result, "Fit the hands")?.detail ?? "";
    expect(hands).not.toContain("snaps over");
    expect(hands).toContain("The date is hidden under this dial");
    expect(qc(result, "qc-date-change")).toBeUndefined();

    expect(step(sheet(DIVER), "Fit the hands")?.detail).toContain("until the date just snaps over");
    expect(step(sheet(DIVER), "Fit the dial")?.detail).not.toContain("snaps over");
  });

  it("presses a domed crystal with a ring die that keeps off the dome", () => {
    const domed = sheet({ ...DIVER, crystalId: "crystal-domed" });
    const prepare = step(domed, "Prepare the case");
    expect(prepare?.detail).not.toContain("flat nylon dies");
    expect(prepare?.detail).toContain("hollow (ring) die");
    expect(prepare?.cautions.join(" ")).toContain("Never press a domed crystal with a flat die");
    expect(domed.tools.some((tool) => tool.startsWith("Hollow (ring) crystal-press die"))).toBe(true);

    const flat = sheet(DIVER);
    expect(step(flat, "Prepare the case")?.detail).toContain("flat nylon dies");
    expect(flat.tools.some((tool) => tool.startsWith("Hollow (ring)"))).toBe(false);
  });

  it("times the movement fully wound in SII's three positions and says what to do about a bad beat error", () => {
    const result = sheet(DIVER);
    const test = step(result, "Test the NH35A before assembly");
    expect(test?.detail).toContain("at least 55 turns");
    expect(test?.detail).toContain("10-60 minutes later");
    expect(test?.detail).toContain("dial up, 9 o'clock up (crown down) and 6 o'clock up");
    expect(test?.cautions.join(" ")).toContain("return or replace it");
    expect(step(result, "Time and regulate")?.detail).toContain("no more than 60 s/day between the fastest and the slowest");
    expect(qc(result, "qc-rate")?.criterion).toContain("no more than 60 s/day between the fastest and the slowest position");
  });

  it("doesn't pass a pressure test below the rating, and never exceeds an unconfirmed one", () => {
    const diver = sheet(DIVER);
    expect(step(diver, "Pressure test")?.detail).toContain("A test at a lower pressure is not a pass");
    expect(step(diver, "Pressure test")?.cautions.join(" ")).not.toContain("hasn't confirmed");
    expect(allText(diver)).not.toContain("record the pressure");

    const dress = step(sheet(DRESS), "Pressure test");
    expect(dress?.detail).toContain("dry-test it at 5 bar");
    expect(dress?.cautions[0]).toBe(
      "The case maker hasn't confirmed the 50m rating in writing: confirm it before testing, and never test above the rating the maker confirms.",
    );
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
    expect(qc(result, "qc-water")?.criterion).toBe(
      "No leak when tested at 30 bar (the case's 300m rating). A test at a lower pressure doesn't pass this check.",
    );
    expect(result.tools).toContain("Pressure tester that reaches 30 bar (the case's rating)");
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
