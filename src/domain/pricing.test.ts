import { describe, expect, it } from "vitest";
import { BENCH_MINUTES } from "./buildSheet";
import { CATALOG } from "./catalog";
import { charmPrice, PRICING_CONFIG, priceSpec } from "./pricing";
import type { Catalog, PriceLine, PriceQuote, WatchSpec } from "./types";

// Real catalogue parts with every field pricing reads pinned, so these tests don't move with the catalogue.
function fixtureCatalog(): Catalog {
  const [movement] = CATALOG.movements;
  const [strap] = CATALOG.straps;
  return {
    movements: [
      { ...movement, id: "mv", name: "Test NH35", complications: ["date"], costEur: 50, leadTimeDays: 7 },
      { ...movement, id: "mv-gmt", name: "Test NH34", complications: ["date", "gmt"], costEur: 90, leadTimeDays: 10 },
    ],
    cases: [{ ...CATALOG.cases[0], id: "case", name: "Test case", costEur: 60, leadTimeDays: 14 }],
    dials: [{ ...CATALOG.dials[0], id: "dial", name: "Test dial", costEur: 25.5, leadTimeDays: 10 }],
    hands: [{ ...CATALOG.hands[0], id: "hands", name: "Test hands", costEur: 15, leadTimeDays: 10 }],
    crystals: [{ ...CATALOG.crystals[0], id: "crystal", name: "Test crystal", costEur: 20, leadTimeDays: 10 }],
    bezelInserts: [{ ...CATALOG.bezelInserts[0], id: "insert", name: "Test insert", costEur: 10.25, leadTimeDays: 21 }],
    straps: [
      { ...strap, id: "strap", name: "Test rubber", type: "rubber", costEur: 18, leadTimeDays: 7 },
      { ...strap, id: "bracelet", name: "Test bracelet", type: "bracelet", costEur: 55, leadTimeDays: 7 },
    ],
  };
}

const SPEC: WatchSpec = {
  name: "Test",
  movementId: "mv",
  caseId: "case",
  dialId: "dial",
  handsId: "hands",
  crystalId: "crystal",
  bezelInsertId: null,
  strapId: "strap",
  personalization: { dialText: "", casebackEngraving: "" },
};
const PARTS_COST = 50 + 60 + 25.5 + 15 + 20 + 18;

function quote(changes: Partial<WatchSpec> = {}): PriceQuote {
  return priceSpec({ ...SPEC, ...changes }, fixtureCatalog());
}

const cents = (eur: number) => Math.round(eur * 100);
const centsOf = (lines: PriceLine[], ...kinds: PriceLine["kind"][]) =>
  lines.filter((line) => kinds.includes(line.kind)).reduce((total, line) => total + cents(line.amountEur), 0);
const labourFor = (minutes: number) => (minutes / 60) * PRICING_CONFIG.labourRateEurPerHour;

describe("priceSpec lines and totals", () => {
  it.each<[string, Partial<WatchSpec>]>([
    ["a plain build", {}],
    [
      "a GMT on a bracelet with an insert and personalization",
      {
        movementId: "mv-gmt",
        bezelInsertId: "insert",
        strapId: "bracelet",
        personalization: { dialText: "Est. 2026", casebackEngraving: "For Anna" },
      },
    ],
    ["a spec with missing parts", { dialId: "nope", strapId: "" }],
  ])("add up exactly for %s", (_, changes) => {
    const result = quote(changes);
    expect(centsOf(result.lines, "part")).toBe(cents(result.partsCostEur));
    expect(centsOf(result.lines, "personalization")).toBe(cents(result.personalizationCostEur));
    expect(centsOf(result.lines, "labour", "qc")).toBe(cents(result.labourCostEur));
    expect(centsOf(result.lines, "overhead")).toBe(cents(result.overheadCostEur));
    expect(centsOf(result.lines, "part", "personalization", "labour", "qc", "overhead")).toBe(cents(result.totalCostEur));
    for (const line of result.lines) expect(Math.abs(line.amountEur * 100 - cents(line.amountEur))).toBeLessThan(1e-6);
  });

  it("prices every part, labour on the shared bench estimate, QC and each overhead item", () => {
    const result = quote();
    expect(result.currency).toBe("EUR");
    expect(result.lines.filter((line) => line.kind === "part").map((line) => line.label)).toEqual([
      "Case: Test case",
      "Movement: Test NH35",
      "Dial: Test dial",
      "Hands: Test hands",
      "Crystal: Test crystal",
      "Strap: Test rubber",
    ]);
    expect(result.partsCostEur).toBe(PARTS_COST);
    expect(result.lines.find((line) => line.kind === "labour")?.amountEur).toBe(labourFor(BENCH_MINUTES.base));
    expect(result.lines.find((line) => line.kind === "qc")?.amountEur).toBe(PRICING_CONFIG.qcEur);
    expect(result.lines.filter((line) => line.kind === "overhead").map((line) => line.label)).toEqual([
      "Packaging",
      "Inbound shipping share",
      `Warranty reserve: ${PRICING_CONFIG.overhead.warrantyReservePctOfParts}% of parts`,
    ]);
  });

  it("reserves the warranty share of the parts cost, rounded to the cent", () => {
    const reserve = quote().lines.find((line) => line.label.startsWith("Warranty reserve"));
    const expected = Math.round(PARTS_COST * PRICING_CONFIG.overhead.warrantyReservePctOfParts) / 100;
    expect(reserve?.amountEur).toBe(expected);
  });

  it("charges more bench time for a GMT hand, a bezel insert and bracelet sizing", () => {
    const labour = (changes: Partial<WatchSpec>) => quote(changes).lines.find((line) => line.kind === "labour")?.amountEur;
    expect(labour({ movementId: "mv-gmt" })).toBe(labourFor(BENCH_MINUTES.base + BENCH_MINUTES.gmtHand));
    expect(labour({ bezelInsertId: "insert" })).toBe(labourFor(BENCH_MINUTES.base + BENCH_MINUTES.bezelInsert));
    expect(labour({ strapId: "bracelet" })).toBe(labourFor(BENCH_MINUTES.base + BENCH_MINUTES.braceletSizing));
  });
});

describe("suggested retail price and margin", () => {
  it("meets the target margin, then rounds up to a price ending in 9", () => {
    const result = quote();
    const atTarget = result.totalCostEur / (1 - PRICING_CONFIG.targetGrossMarginPct / 100);
    expect(result.suggestedRetailEur % 10).toBe(9);
    expect(result.suggestedRetailEur).toBeGreaterThanOrEqual(atTarget);
    expect(result.suggestedRetailEur - atTarget).toBeLessThan(10);
  });

  it("reports the margin of the final rounded price", () => {
    const result = quote();
    const margin = ((result.suggestedRetailEur - result.totalCostEur) / result.suggestedRetailEur) * 100;
    expect(result.marginPct).toBeCloseTo(margin, 1);
    expect(result.marginPct).toBeGreaterThanOrEqual(PRICING_CONFIG.targetGrossMarginPct);
  });
});

describe("charmPrice", () => {
  it.each([
    [347.2, 349],
    [349, 349],
    [349.01, 359],
    [350, 359],
    [340, 349],
    [0.5, 9],
    [1234.56, 1239],
  ])("rounds %d up to %d", (amount, expected) => {
    expect(charmPrice(amount)).toBe(expected);
  });

  it("isn't pushed to the next step by floating-point noise", () => {
    expect(charmPrice(191.95 / 0.55)).toBe(349);
    expect(charmPrice(348.99999999999994)).toBe(349);
  });
});

describe("personalization", () => {
  const { dialText, casebackEngraving } = PRICING_CONFIG.personalization;

  it("adds the service cost, bench time and a print/engrave step to the lead time", () => {
    const plain = quote();
    const printed = quote({ personalization: { dialText: "Est. 2026", casebackEngraving: "" } });
    expect(printed.personalizationCostEur).toBe(dialText.costEur);
    expect(printed.lines).toContainEqual({
      label: `${dialText.label}: "Est. 2026"`,
      kind: "personalization",
      amountEur: dialText.costEur,
    });
    expect(printed.labourCostEur - plain.labourCostEur).toBeCloseTo(labourFor(BENCH_MINUTES.perPersonalization), 2);
    expect(printed.leadTimeDays).toBe(plain.leadTimeDays + dialText.leadTimeDays);
    expect(printed.totalCostEur).toBeGreaterThan(plain.totalCostEur);
  });

  it("runs printing and engraving in parallel but charges for both", () => {
    const plain = quote();
    const both = quote({ personalization: { dialText: "Est. 2026", casebackEngraving: "For Anna" } });
    expect(both.personalizationCostEur).toBe(dialText.costEur + casebackEngraving.costEur);
    expect(both.leadTimeDays).toBe(plain.leadTimeDays + Math.max(dialText.leadTimeDays, casebackEngraving.leadTimeDays));
  });

  it("ignores whitespace-only text", () => {
    const blank = quote({ personalization: { dialText: "   ", casebackEngraving: "\n" } });
    expect(blank.personalizationCostEur).toBe(0);
    expect(blank.leadTimeDays).toBe(quote().leadTimeDays);
  });
});

describe("lead time", () => {
  it("is the slowest part plus bench and QC days", () => {
    expect(quote().leadTimeDays).toBe(14 + PRICING_CONFIG.benchAndQcDays);
    expect(quote({ bezelInsertId: "insert" }).leadTimeDays).toBe(21 + PRICING_CONFIG.benchAndQcDays);
  });
});

describe("missing parts", () => {
  it("contribute nothing instead of throwing", () => {
    const result = quote({ dialId: "nope", strapId: "", handsId: "strap" });
    expect(result.partsCostEur).toBe(PARTS_COST - 25.5 - 18 - 15);
    expect(result.lines.some((line) => line.label.startsWith("Dial") || line.label.startsWith("Hands"))).toBe(false);
  });

  it("still price the workshop's own costs for an empty spec", () => {
    const empty = quote({ movementId: "", caseId: "", dialId: "", handsId: "", crystalId: "", strapId: "" });
    expect(empty.partsCostEur).toBe(0);
    expect(empty.labourCostEur).toBe(labourFor(BENCH_MINUTES.base) + PRICING_CONFIG.qcEur);
    expect(empty.leadTimeDays).toBe(PRICING_CONFIG.benchAndQcDays);
  });
});
