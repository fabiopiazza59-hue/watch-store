import { describe, expect, it } from "vitest";
import type { Catalog, Dial, HandSet, Part, WatchCase } from "../types";
import { validateSpec } from "../rules";
import { CATALOG, DEFAULT_SPEC, TEMPLATES, resolveSpec } from ".";

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

  it("only fits bracelets to cases that exist and share their width", () => {
    for (const s of CATALOG.straps) {
      for (const caseId of s.compatibleCaseIds ?? []) {
        const c = CATALOG.cases.find((x) => x.id === caseId);
        expect(c, `${s.id} -> ${caseId}`).toBeDefined();
        expect(c?.lugWidthMm, `${s.id} -> ${caseId}`).toBe(s.widthMm);
      }
    }
  });
});

describe("catalogue coverage", () => {
  it.each(CATALOG.cases.map((c) => [c.id, c] as const))("%s has enough compatible parts", (_, c) => {
    const dials = CATALOG.dials.filter((d) => dialFitsCase(d, c));
    const hands = CATALOG.hands.filter((h) => !h.includesGmt && dials.some((d) => handsFitDial(h, d)));
    const crystals = CATALOG.crystals.filter((x) => within(x.diameterMm, c.crystalDiameterMm, 0.1));
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
});
