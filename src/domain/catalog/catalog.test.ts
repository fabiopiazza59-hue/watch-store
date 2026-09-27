import { describe, expect, it } from "vitest";
import type { Catalog, Dial, HandSet, Part, WatchCase } from "../types";
import { reviewText, validateSpec } from "../rules";
import { CATALOG, DEFAULT_SPEC, TEMPLATES, dateWheelColour, resolveSpec } from ".";

const CATEGORY_BY_KEY: Record<keyof Catalog, Part["category"]> = {
  movements: "movement",
  cases: "case",
  dials: "dial",
  hands: "hands",
  crystals: "crystal",
  bezelInserts: "bezelInsert",
  straps: "strap",
};

const allParts: Part[] = Object.values(CATALOG).flat();

const STARTING_SPECS = [
  { label: "DEFAULT_SPEC", spec: DEFAULT_SPEC },
  ...TEMPLATES.map((t) => ({ label: t.id, spec: t.spec })),
];

/** Tolerances from docs/feasibility-rules.md; the epsilon absorbs floating-point noise. */
const within = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance + 1e-9;

const hasInsertBezel = (c: WatchCase) => c.bezel === "unidirectional-120" || c.bezel === "bidirectional-24h";

const dialFitsCase = (d: Dial, c: WatchCase) =>
  within(d.diameterMm, c.dialDiameterMm, 0.2) && d.crownPosition === c.crownPosition;

const handsFitDial = (h: HandSet, d: Dial) => {
  const radius = d.diameterMm / 2;
  return (
    Math.max(h.lengthsMm.minute, h.lengthsMm.seconds) <= radius - 0.3 &&
    h.lengthsMm.minute >= 0.75 * radius
  );
};

describe("catalogue integrity", () => {
  it("uses every id exactly once across all categories", () => {
    const ids = allParts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("files every part under its own category", () => {
    for (const [key, category] of Object.entries(CATEGORY_BY_KEY)) {
      for (const part of CATALOG[key as keyof Catalog]) {
        expect(part.category, part.id).toBe(category);
      }
    }
  });

  it("gives every part a positive cost and lead time", () => {
    for (const part of allParts) {
      expect(part.costEur, part.id).toBeGreaterThan(0);
      expect(part.leadTimeDays, part.id).toBeGreaterThan(0);
    }
  });

  it("describes an insert seat exactly for the cases with an insert bezel", () => {
    for (const c of CATALOG.cases) {
      expect(c.insertMm !== undefined, c.id).toBe(hasInsertBezel(c));
    }
  });

  it("keeps GMT pinions, GMT hands and complications consistent", () => {
    for (const m of CATALOG.movements) {
      expect(m.handHolesMm.gmt !== undefined, m.id).toBe(m.complications.includes("gmt"));
    }
    for (const h of CATALOG.hands) {
      expect(h.holesMm.gmt !== undefined, h.id).toBe(h.includesGmt);
      expect(h.lengthsMm.gmt !== undefined, h.id).toBe(h.includesGmt);
      expect(h.gmtColorHex !== undefined, h.id).toBe(h.includesGmt);
    }
  });

  it("sells every GMT dial NH34-ready and every other dial with a standard centre hole", () => {
    const nh34 = CATALOG.movements.find((m) => m.caliber === "NH34A");
    const nh35 = CATALOG.movements.find((m) => m.caliber === "NH35A");
    for (const d of CATALOG.dials) {
      const spec = (movementId: string) => ({ ...DEFAULT_SPEC, movementId, dialId: d.id });
      const holeIssues = (movementId: string) =>
        validateSpec(spec(movementId)).issues.filter((issue) => issue.ruleId === "dial-center-hole");
      expect(holeIssues(nh35!.id), d.id).toEqual([]);
      expect(holeIssues(nh34!.id).length, d.id).toBe(d.style === "gmt" ? 0 : 1);
    }
  });

  it("flags every water-resistance rating the maker hasn't confirmed, with a note on the figure used", () => {
    const unconfirmed = CATALOG.cases.filter((c) => c.waterResistanceEstimated);
    expect(unconfirmed.map((c) => c.id)).toEqual(["case-diver-39", "case-dress-39", "case-pilot-39"]);
    for (const c of unconfirmed) expect(c.dataNotes, c.id).toContain(`${c.waterResistanceM}m`);
    // The compact diver's maker publishes 5 ATM / 50 m; nothing higher may be claimed until confirmed.
    expect(CATALOG.cases.find((c) => c.id === "case-diver-39")?.waterResistanceM).toBe(50);
  });

  it("only fits bracelets to cases that exist and share their width", () => {
    for (const s of CATALOG.straps) {
      for (const caseId of s.compatibleCaseIds ?? []) {
        const c = CATALOG.cases.find((x) => x.id === caseId);
        expect(c, `${s.id} -> ${caseId}`).toBeDefined();
        expect(c?.lugWidthMm, `${s.id} -> ${caseId}`).toBe(s.widthMm);
      }
    }
  });

  it("gives every colour as a 6-digit hex value, which the preview and date-wheel rule read", () => {
    const hex = /^#[0-9a-f]{6}$/i;
    for (const part of allParts) {
      const colours = Object.entries(part).filter(([key]) => key.endsWith("ColorHex") || key === "colorHex");
      for (const [key, value] of colours) expect(value, `${part.id}.${key}`).toMatch(hex);
    }
  });

  it("names parts and starting designs without other watch companies' names or Swiss indications", () => {
    const texts = [
      ...allParts.map((p) => [p.id, p.name] as const),
      ...TEMPLATES.flatMap((t) => [[t.id, t.name] as const, [t.id, t.description] as const, [t.id, t.spec.name] as const]),
    ];
    for (const [id, text] of texts) {
      const review = reviewText(text);
      expect([...review.trademarks, ...review.protectedIndications], `${id}: ${text}`).toEqual([]);
    }
  });
});

describe("catalogue coverage", () => {
  it.each(CATALOG.cases.map((c) => [c.id, c] as const))("%s has enough compatible parts", (_, c) => {
    const dials = CATALOG.dials.filter((d) => dialFitsCase(d, c));
    const hands = CATALOG.hands.filter((h) => !h.includesGmt && dials.some((d) => handsFitDial(h, d)));
    const crystals = CATALOG.crystals.filter((x) => within(x.diameterMm, c.crystalDiameterMm, 0.05));
    const straps = CATALOG.straps.filter(
      (s) => s.widthMm === c.lugWidthMm && (!s.compatibleCaseIds?.length || s.compatibleCaseIds.includes(c.id)),
    );

    expect(dials.length).toBeGreaterThanOrEqual(2);
    expect(hands.length).toBeGreaterThanOrEqual(1);
    expect(crystals.length).toBeGreaterThanOrEqual(1);
    expect(straps.length).toBeGreaterThanOrEqual(2);

    const seat = c.insertMm;
    if (seat) {
      const inserts = CATALOG.bezelInserts.filter(
        (i) => within(i.outerMm, seat.outer, 0.1) && within(i.innerMm, seat.inner, 0.1),
      );
      expect(inserts.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("offers real physical choices, so some combinations must fail", () => {
    const distinct = <T>(values: T[]) => new Set(values).size;
    expect(distinct(CATALOG.cases.map((c) => c.crownPosition))).toBeGreaterThanOrEqual(2);
    expect(distinct(CATALOG.cases.map((c) => c.dialDiameterMm))).toBeGreaterThanOrEqual(2);
    expect(distinct(CATALOG.cases.map((c) => c.crystalDiameterMm))).toBeGreaterThanOrEqual(2);
    expect(distinct(CATALOG.cases.map((c) => c.lugWidthMm))).toBeGreaterThanOrEqual(2);
    expect(distinct(CATALOG.bezelInserts.map((i) => i.outerMm))).toBeGreaterThanOrEqual(2);
    expect(distinct(CATALOG.movements.map((m) => m.dateDisplay))).toBeGreaterThanOrEqual(3);
  });

  it("offers a dress case with a solid caseback, so a dress watch can be engraved", () => {
    const engravable = CATALOG.cases.filter((c) => c.style === "dress" && c.caseback === "solid");
    expect(engravable.length).toBeGreaterThanOrEqual(1);
    for (const c of engravable) {
      const dial = CATALOG.dials.find((d) => d.style === "dress" && dialFitsCase(d, c));
      expect(dial, c.id).toBeDefined();
    }
  });

  it("offers cases of 36mm or less for smaller wrists, in more than one style", () => {
    const small = CATALOG.cases.filter((c) => c.diameterMm <= 36);
    expect(new Set(small.map((c) => c.style)).size).toBeGreaterThanOrEqual(2);
  });

  it("offers the wide-opening cases a choice of dials and hands", () => {
    const wide = CATALOG.dials.filter((d) => d.diameterMm === 33.5);
    expect(wide.length).toBeGreaterThanOrEqual(5);
    expect(CATALOG.hands.filter((h) => wide.some((d) => handsFitDial(h, d))).length).toBeGreaterThanOrEqual(3);
  });
});

describe("NH34 seconds-hand clearance", () => {
  const nh34Spec = (caseId: string, crystalId: string) => ({
    ...DEFAULT_SPEC,
    movementId: "mv-nh34a",
    caseId,
    dialId: "dial-gmt-black",
    handsId: "hands-gmt-mercedes-red",
    crystalId,
    bezelInsertId: null,
    strapId: "strap-leather-black-20",
  });
  const clearanceWarnings = (spec: ReturnType<typeof nh34Spec>) =>
    validateSpec(spec).issues.filter((i) => i.ruleId === "hand-clearance" && i.slots.includes("crystalId"));

  it("warns about a flat crystal in the dress case, which is only sold NH34-ready with its double-dome", () => {
    const [issue] = clearanceWarnings(nh34Spec("case-dress-39", "crystal-sapphire-flat-295"));
    expect(issue.severity).toBe("warning");
    expect(issue.fixes[0]?.patch).toEqual({ crystalId: "crystal-sapphire-dd-295" });
    expect(clearanceWarnings(nh34Spec("case-dress-39", "crystal-sapphire-dd-295"))).toEqual([]);
  });

  it("lets the short-seconds GMT set clear a flat crystal in a case made for three-hand movements", () => {
    const bronze = nh34Spec("case-diver-bronze-40", "crystal-sapphire-flat-305");
    expect(clearanceWarnings(bronze)).toHaveLength(1);
    expect(clearanceWarnings({ ...bronze, handsId: "hands-gmt-sword-gilt" })).toEqual([]);
  });

  it("warns about an NH34 in the small cases whose makers don't list it", () => {
    for (const caseId of ["case-field-36", "case-dress-36"]) {
      const spec = { ...nh34Spec(caseId, "crystal-sapphire-dd-295"), handsId: "hands-gmt-sword-gilt" };
      const tight = validateSpec(spec).issues.filter((i) => i.ruleId === "hand-clearance" && i.slots.includes("caseId"));
      expect(tight.map((i) => i.severity), caseId).toEqual(["warning"]);
    }
  });

  it("leaves the Travel GMT, in a case sold NH34-ready with its flat crystal, without a clearance warning", () => {
    const travel = TEMPLATES.find((t) => t.id === "tpl-travel-gmt")!;
    expect(validateSpec(travel.spec).issues.filter((i) => i.ruleId === "hand-clearance")).toEqual([]);
  });
});

describe("dateWheelColour", () => {
  it.each([
    ["#15171a", "black"],
    ["#1d3a6b", "black"],
    ["#efe6d2", "white"],
    ["#fff", "white"],
    ["not a colour", "black"],
  ] as const)("%s gets a %s date wheel", (colorHex, colour) => {
    expect(dateWheelColour({ colorHex })).toBe(colour);
  });
});

describe("starting designs", () => {
  it("have unique template ids", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(STARTING_SPECS.map(({ label, spec }) => [label, spec] as const))(
    "%s resolves every part id",
    (_, spec) => {
      const parts = resolveSpec(spec);
      expect(parts.movement).toBeDefined();
      expect(parts.case).toBeDefined();
      expect(parts.dial).toBeDefined();
      expect(parts.hands).toBeDefined();
      expect(parts.crystal).toBeDefined();
      expect(parts.strap).toBeDefined();
      expect(parts.bezelInsert !== undefined).toBe(spec.bezelInsertId !== null);
    },
  );

  it.each(STARTING_SPECS.map(({ label, spec }) => [label, spec] as const))(
    "%s is buildable according to the rules engine",
    (_, spec) => {
      const report = validateSpec(spec);
      expect(report.issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(report.buildable).toBe(true);
    },
  );

  it.each(STARTING_SPECS.map(({ label, spec }) => [label, spec] as const))(
    "%s carries no warnings: nothing the customer has to accept knowingly",
    (_, spec) => {
      const warnings = validateSpec(spec).issues.filter((i) => i.severity === "warning");
      expect(warnings.map((i) => `${i.ruleId}: ${i.message}`)).toEqual([]);
    },
  );

  it("are named after themselves and add no extras, which stay the customer's choice", () => {
    for (const t of TEMPLATES) {
      expect(t.spec.name, t.id).toBe(t.name);
      expect("extras" in t.spec, t.id).toBe(false);
      expect(t.spec.personalization, t.id).toEqual({ dialText: "", casebackEngraving: "" });
    }
  });
});
