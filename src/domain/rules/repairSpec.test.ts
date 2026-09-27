import { describe, expect, it } from "vitest";
import type { ValidationReport, WatchSpec } from "../types";
import { repairSpec, validateSpec } from ".";
import { BASE_SPEC, fixtureCatalog, specWith } from "./__fixtures__/catalog";
import { MAX_REPAIR_STEPS, repair } from "./repair";

describe("repairSpec", () => {
  it("leaves a buildable spec alone", () => {
    const result = repairSpec(BASE_SPEC, fixtureCatalog());
    expect(result).toEqual({ spec: BASE_SPEC, changes: [], report: validateSpec(BASE_SPEC, fixtureCatalog()) });
  });

  it("applies the first fix of each error until the spec is buildable", () => {
    const broken = specWith(
      { crystalId: "crystal-sapphire-320", strapId: "strap-nato-olive-20" },
      { dialText: "ROLEX", casebackEngraving: "For Anna" },
    );
    const result = repairSpec(broken, fixtureCatalog());
    expect(result.report.buildable).toBe(true);
    expect(result.changes).toEqual([
      "Crystal: Sapphire domed 32mm → Sapphire flat 31.5mm",
      "Strap: Olive NATO 20mm → Black NATO 22mm",
      "Dial text: 'ROLEX' → none",
    ]);
    expect(result.spec.personalization).toEqual({ dialText: "", casebackEngraving: "For Anna" });
  });

  it("fills in every missing part", () => {
    const empty: WatchSpec = {
      ...BASE_SPEC,
      movementId: "",
      caseId: "",
      dialId: "",
      handsId: "",
      crystalId: "",
      bezelInsertId: null,
      strapId: "",
    };
    const result = repairSpec(empty, fixtureCatalog());
    expect(result.report.buildable).toBe(true);
    expect(result.changes).toHaveLength(6);
    expect(result.changes[0]).toMatch(/^Case: none → /);
  });

  it("stops when an error has no fix", () => {
    const catalog = fixtureCatalog();
    for (const hands of catalog.hands) hands.holesMm.minute = 1;
    const result = repairSpec(BASE_SPEC, catalog);
    expect(result.spec).toEqual(BASE_SPEC);
    expect(result.changes).toEqual([]);
    expect(result.report.buildable).toBe(false);
  });
});

describe("the repair loop", () => {
  const catalog = fixtureCatalog();

  function unbuildable(fixPatch: Partial<WatchSpec>): ValidationReport {
    return {
      buildable: false,
      issues: [{ ruleId: "test", severity: "error", message: "", slots: [], fixes: [{ description: "", patch: fixPatch }] }],
    };
  }

  it("stops before revisiting a spec", () => {
    const toggle = (spec: WatchSpec) =>
      unbuildable({ strapId: spec.strapId === "strap-nato-black-22" ? "strap-rubber-black-22" : "strap-nato-black-22" });
    const result = repair(BASE_SPEC, toggle, catalog);
    expect(result.changes).toEqual(["Strap: Black rubber 22mm → Black NATO 22mm"]);
    expect(result.spec.strapId).toBe("strap-nato-black-22");
  });

  it(`stops after ${MAX_REPAIR_STEPS} steps`, () => {
    const endless = (spec: WatchSpec) =>
      unbuildable({ personalization: { ...spec.personalization, dialText: `${spec.personalization.dialText}x` } });
    const result = repair(BASE_SPEC, endless, catalog);
    expect(result.changes).toHaveLength(MAX_REPAIR_STEPS);
    expect(result.spec.personalization.dialText).toBe("x".repeat(MAX_REPAIR_STEPS));
  });
});
