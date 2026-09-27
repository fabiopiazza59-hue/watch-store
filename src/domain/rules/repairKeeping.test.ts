import { describe, expect, it } from "vitest";
import { CATALOG, DEFAULT_SPEC } from "../catalog";
import type { WatchSpec } from "../types";
import { describeChanges, repairAround, repairKeeping, repairSpec, validateSpec } from ".";
import { BASE_SPEC, fixtureCatalog, specWith } from "./__fixtures__/catalog";

const FIELD_OLIVE: WatchSpec = { ...DEFAULT_SPEC, dialId: "dial-field-olive" };

describe("repairAround", () => {
  it("takes the same first step as repairSpec when nothing is locked", () => {
    const broken: WatchSpec = { ...DEFAULT_SPEC, strapId: "strap-nato-olive-20", crystalId: "crystal-sapphire-flat-295" };
    expect(repairAround(broken, []).spec).toEqual(repairSpec(broken).spec);
  });

  it("leaves a buildable design alone", () => {
    expect(repairAround(DEFAULT_SPEC, ["dialId"])).toEqual({
      spec: DEFAULT_SPEC,
      changes: [],
      report: validateSpec(DEFAULT_SPEC),
    });
  });

  it("fits the rest around a case chosen for the customer's dial", () => {
    const result = repairAround({ ...FIELD_OLIVE, caseId: "case-field-38" }, ["dialId", "caseId"]);
    expect(result.report.buildable).toBe(true);
    expect(result.spec).toMatchObject({ dialId: "dial-field-olive", caseId: "case-field-38", bezelInsertId: null });
    expect(result.changes.map((change) => change.split(":")[0]).sort()).toEqual(["Bezel insert", "Crystal", "Strap"]);
  });

  it("never touches a locked slot, even when that leaves the design unbuildable", () => {
    const result = repairAround(FIELD_OLIVE, ["dialId", "caseId"]);
    expect(result.spec.dialId).toBe("dial-field-olive");
    expect(result.spec.caseId).toBe(DEFAULT_SPEC.caseId);
    expect(result.report.buildable).toBe(false);
  });
});

describe("repairKeeping", () => {
  it("keeps the dial the customer chose where the plain repair swaps it back", () => {
    expect(repairSpec(FIELD_OLIVE).spec.dialId).not.toBe("dial-field-olive");

    const result = repairKeeping(FIELD_OLIVE, ["dialId"]);
    expect(result.report.buildable).toBe(true);
    expect(result.spec.dialId).toBe("dial-field-olive");
    expect(validateSpec(result.spec).buildable).toBe(true);
    expect(result.changes.some((change) => change.startsWith("Case:"))).toBe(true);
  });

  it("prefers the fewest changes and caveats among the designs that work", () => {
    const cost = (result: { spec: WatchSpec }) =>
      describeChanges(FIELD_OLIVE, result.spec, CATALOG).length +
      validateSpec(result.spec).issues.filter((issue) => issue.severity === "warning").length;
    const result = repairKeeping(FIELD_OLIVE, ["dialId"]);
    for (const caseId of ["case-field-38", "case-gmt-40"]) {
      const alternative = repairAround({ ...FIELD_OLIVE, caseId }, ["dialId", "caseId"]);
      expect(alternative.report.buildable).toBe(true);
      expect(cost(result)).toBeLessThanOrEqual(cost(alternative));
    }
  });

  it("builds a GMT around GMT hands, which single-part fixes never reach", () => {
    const gmtHands: WatchSpec = { ...DEFAULT_SPEC, handsId: "hands-gmt-mercedes-red" };
    expect(repairSpec(gmtHands).spec.handsId).not.toBe("hands-gmt-mercedes-red");

    const result = repairKeeping(gmtHands, ["handsId"]);
    expect(result.report.buildable).toBe(true);
    expect(result.spec).toMatchObject({ handsId: "hands-gmt-mercedes-red", movementId: "mv-nh34a" });
  });

  it("never changes a locked slot with another catalogue either", () => {
    const catalog = fixtureCatalog();
    const broken = specWith({ crystalId: "crystal-sapphire-320", strapId: "strap-nato-olive-20" });
    const result = repairKeeping(broken, ["strapId"], catalog);
    expect(result.spec.strapId).toBe("strap-nato-olive-20");
    expect(result.spec.crystalId).not.toBe("crystal-sapphire-320");
    expect(repairAround(BASE_SPEC, ["strapId"], catalog).changes).toEqual([]);
  });

  it("returns the greedy result when nothing fits around the locked parts", () => {
    const result = repairKeeping({ ...DEFAULT_SPEC, caseId: "case-does-not-exist" }, ["caseId"]);
    expect(result.report.buildable).toBe(false);
    expect(result.spec.caseId).toBe("case-does-not-exist");
  });
});
