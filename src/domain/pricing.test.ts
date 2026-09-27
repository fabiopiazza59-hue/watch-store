import { describe, expect, it } from "vitest";
import { BENCH_MINUTES } from "./buildSheet";
import { CATALOG, EXTRAS } from "./catalog";
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
      { ...strap, id: "nato", name: "Test NATO", type: "nato", costEur: 9.5, leadTimeDays: 20 },
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
    ["a spare strap and every add-on", { extras: { spareStrapId: "nato", itemIds: EXTRAS.map((extra) => extra.id) } }],
    ["unknown extras", { extras: { spareStrapId: "strap-nope", itemIds: ["extra-nope"] } }],
  ])("add up exactly for %s", (_, changes) => {
    const result = quote(changes);
    expect(centsOf(result.lines, "part")).toBe(cents(result.partsCostEur));
    expect(centsOf(result.lines, "personalization")).toBe(cents(result.personalizationCostEur));
    expect(centsOf(result.lines, "extra")).toBe(cents(result.extrasCostEur));
    expect(centsOf(result.lines, "labour", "qc")).toBe(cents(result.labourCostEur));
    expect(centsOf(result.lines, "overhead")).toBe(cents(result.overheadCostEur));
    expect(centsOf(result.lines, "part", "personalization", "extra", "labour", "qc", "overhead")).toBe(cents(result.totalCostEur));
    expect(
      cents(result.partsCostEur) +
        cents(result.personalizationCostEur) +
        cents(result.extrasCostEur) +
        cents(result.labourCostEur) +
        cents(result.overheadCostEur),
    ).toBe(cents(result.totalCostEur));
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
    const { overhead } = PRICING_CONFIG;
    expect(result.lines.filter((line) => line.kind === "overhead").map((line) => line.label)).toEqual([
      "Packaging",
      `Inbound shipping: 6 part parcels at €${overhead.inboundShippingEurPerPart}`,
      "Insured, tracked shipping to the customer",
      "Consumables and a spare stem",
      `Warranty reserve: ${overhead.warrantyReservePctOfParts}% of parts`,
      `Payment fee: ${overhead.paymentFeePct}% of the price paid`,
    ]);
  });

  it("charges inbound shipping per part, as a parcel each", () => {
    const inbound = (changes: Partial<WatchSpec>) =>
      quote(changes).lines.find((line) => line.label.startsWith("Inbound shipping"))?.amountEur;
    const perPart = PRICING_CONFIG.overhead.inboundShippingEurPerPart;
    expect(inbound({})).toBe(6 * perPart);
    expect(inbound({ bezelInsertId: "insert" })).toBe(7 * perPart);
    expect(inbound({ dialId: "nope" })).toBe(5 * perPart);
  });

  it("takes the payment fee on the price the customer pays, VAT included", () => {
    const result = quote();
    const fee = result.lines.find((line) => line.label.startsWith("Payment fee"));
    expect(fee?.amountEur).toBe(Math.round(result.retailInclVatEur * PRICING_CONFIG.overhead.paymentFeePct) / 100);
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

describe("consumer price, VAT and margin", () => {
  const vatFactor = 1 + PRICING_CONFIG.vatRatePct / 100;
  const marginOn = (net: number, cost: number) => ((net - cost) / net) * 100;

  it.each<[string, Partial<WatchSpec>]>([
    ["a plain build", {}],
    ["a GMT on a bracelet with an insert", { movementId: "mv-gmt", bezelInsertId: "insert", strapId: "bracelet" }],
  ])("shows a VAT-inclusive price ending in 9 and splits out the VAT, for %s", (_, changes) => {
    const result = quote(changes);
    expect(result.vatRatePct).toBe(PRICING_CONFIG.vatRatePct);
    expect(result.retailInclVatEur % 10).toBe(9);
    expect(cents(result.suggestedRetailEur) + cents(result.vatEur)).toBe(cents(result.retailInclVatEur));
    expect(result.suggestedRetailEur * vatFactor).toBeCloseTo(result.retailInclVatEur, 1);
  });

  it("is the lowest such price that keeps the target margin on the price excluding VAT", () => {
    const result = quote();
    expect(marginOn(result.suggestedRetailEur, result.totalCostEur)).toBeGreaterThanOrEqual(PRICING_CONFIG.targetGrossMarginPct - 0.01);

    // Ten euros less, with the payment fee on that lower price, would miss the target.
    const lowerGross = result.retailInclVatEur - 10;
    const feeDrop = (10 * PRICING_CONFIG.overhead.paymentFeePct) / 100;
    expect(marginOn(lowerGross / vatFactor, result.totalCostEur - feeDrop)).toBeLessThan(PRICING_CONFIG.targetGrossMarginPct);
  });

  it("reports the margin earned on the price excluding VAT, after every cost", () => {
    const result = quote();
    expect(result.marginPct).toBeCloseTo(marginOn(result.suggestedRetailEur, result.totalCostEur), 1);
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

describe("extras", () => {
  const extra = (id: string) => {
    const found = EXTRAS.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`No extra ${id}`);
    return found;
  };
  const box = extra("extra-presentation-box");
  const pouch = extra("extra-travel-pouch");
  const tool = extra("extra-spring-bar-tool");
  const giftWrap = extra("extra-gift-wrap");
  const regulation = extra("extra-fine-regulation");
  const everything = { spareStrapId: "nato", itemIds: EXTRAS.map((candidate) => candidate.id) };

  it("prices a line for the spare strap and one per add-on, in catalogue order", () => {
    const result = quote({ extras: everything });
    expect(result.lines.filter((line) => line.kind === "extra")).toEqual([
      { label: "Spare strap: Test NATO", kind: "extra", amountEur: 9.5 },
      ...EXTRAS.map((candidate) => ({ label: candidate.name, kind: "extra", amountEur: candidate.costEur })),
    ]);
    expect(result.extrasCostEur).toBe(9.5 + EXTRAS.reduce((total, candidate) => total + candidate.costEur, 0));
    expect(result.partsCostEur).toBe(PARTS_COST);
  });

  it("charges the extras' bench time as labour, on a line of its own", () => {
    const plain = quote();
    const result = quote({ extras: { spareStrapId: "nato", itemIds: [giftWrap.id, regulation.id] } });
    const minutes = BENCH_MINUTES.spareStrap + giftWrap.benchMinutes + regulation.benchMinutes;
    const labour = result.lines.filter((line) => line.kind === "labour");
    expect(labour.map((line) => line.label)).toEqual([
      `Assembly labour: ${BENCH_MINUTES.base} min at €${PRICING_CONFIG.labourRateEurPerHour}/h`,
      `Bench time for extras: ${minutes} min at €${PRICING_CONFIG.labourRateEurPerHour}/h`,
    ]);
    expect(result.labourCostEur - plain.labourCostEur).toBeCloseTo(labourFor(minutes), 2);
    expect(quote({ extras: { spareStrapId: null, itemIds: [box.id] } }).lines.filter((line) => line.kind === "labour")).toHaveLength(1);
  });

  it("sizes a spare bracelet like one on the watch", () => {
    const labour = (spareStrapId: string) =>
      quote({ extras: { spareStrapId, itemIds: [] } }).lines.find((line) => line.label.startsWith("Bench time for extras"))?.amountEur;
    expect(labour("bracelet")).toBe(labourFor(BENCH_MINUTES.spareStrap + BENCH_MINUTES.braceletSizing));
  });

  it("counts the spare strap and each bought-in add-on as an inbound parcel, but not stock or bench services", () => {
    const inbound = (extras: WatchSpec["extras"]) =>
      quote({ extras }).lines.find((line) => line.label.startsWith("Inbound shipping"));
    const perPart = PRICING_CONFIG.overhead.inboundShippingEurPerPart;
    expect(inbound({ spareStrapId: null, itemIds: [giftWrap.id, regulation.id] })).toEqual(inbound(undefined));
    expect(inbound({ spareStrapId: "nato", itemIds: [] })).toEqual({
      label: `Inbound shipping: 7 parcels (6 parts, 1 extra) at €${perPart}`,
      kind: "overhead",
      amountEur: 7 * perPart,
    });
    const bought = [box, pouch, tool].filter((candidate) => candidate.leadTimeDays > 0).length;
    expect(inbound(everything)?.label).toBe(`Inbound shipping: ${7 + bought} parcels (6 parts, ${1 + bought} extras) at €${perPart}`);
  });

  it("keeps the warranty reserve on the watch's parts only", () => {
    const reserve = (changes: Partial<WatchSpec>) => quote(changes).lines.find((line) => line.label.startsWith("Warranty reserve"));
    expect(reserve({ extras: everything })).toEqual(reserve({}));
  });

  it("waits for the slowest extra when it comes in after the parts", () => {
    const { benchAndQcDays } = PRICING_CONFIG;
    expect(quote({ extras: { spareStrapId: null, itemIds: [box.id] } }).leadTimeDays).toBe(Math.max(14, box.leadTimeDays) + benchAndQcDays);
    expect(quote({ extras: { spareStrapId: "nato", itemIds: [] } }).leadTimeDays).toBe(20 + benchAndQcDays);
    // Printing waits for its dial; the spare strap only has to be in by then.
    const printed = { personalization: { dialText: "Est. 2026", casebackEngraving: "" } };
    const dialPrinting = PRICING_CONFIG.personalization.dialText.leadTimeDays;
    expect(quote({ ...printed, extras: { spareStrapId: "nato", itemIds: [] } }).leadTimeDays).toBe(
      Math.max(14 + dialPrinting, 20) + benchAndQcDays,
    );
  });

  it("prices unknown extras at nothing instead of throwing, and treats no extras as before", () => {
    const plain = quote();
    expect(plain.extrasCostEur).toBe(0);
    expect(quote({ extras: { spareStrapId: null, itemIds: [] } })).toEqual(plain);
    expect(quote({ extras: { spareStrapId: "strap-nope", itemIds: ["extra-nope"] } })).toEqual(plain);
  });

  it("raises the price the customer pays", () => {
    expect(quote({ extras: everything }).retailInclVatEur).toBeGreaterThan(quote().retailInclVatEur);
  });
});
