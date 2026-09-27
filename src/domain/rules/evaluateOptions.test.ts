import { describe, expect, it } from "vitest";
import { NONE_OPTION_ID } from "../catalog";
import type { OptionStatus } from "../types";
import { evaluateOptions } from ".";
import { BASE_SPEC, FIELD_SPEC, fixtureCatalog, specWith } from "./__fixtures__/catalog";

function verdicts(options: OptionStatus[]): Record<string, boolean> {
  return Object.fromEntries(options.map((option) => [option.partId, option.compatible]));
}

describe("evaluateOptions", () => {
  it("lists every part of the slot in catalogue order", () => {
    const catalog = fixtureCatalog();
    expect(evaluateOptions("strapId", BASE_SPEC, catalog).map((option) => option.partId)).toEqual(
      catalog.straps.map((strap) => strap.id),
    );
  });

  it("marks parts that fit the rest of the spec as compatible", () => {
    expect(verdicts(evaluateOptions("strapId", BASE_SPEC, fixtureCatalog()))).toEqual({
      "strap-rubber-black-22": true,
      "strap-rubber-black-20": false,
      "strap-nato-olive-20": false,
      "strap-leather-brown-20": false,
      "strap-nato-black-22": true,
      "strap-bracelet-diver-22": true,
    });
  });

  it("starts the bezel insert options with 'none'", () => {
    const options = evaluateOptions("bezelInsertId", BASE_SPEC, fixtureCatalog());
    expect(options[0].partId).toBe(NONE_OPTION_ID);
    expect(verdicts(options)).toEqual({
      [NONE_OPTION_ID]: false,
      "insert-dive-black": true,
      "insert-dive-blue": true,
      "insert-gmt-pepsi": true,
      "insert-dive-small": false,
    });
    expect(verdicts(evaluateOptions("bezelInsertId", FIELD_SPEC, fixtureCatalog()))).toEqual({
      [NONE_OPTION_ID]: true,
      "insert-dive-black": false,
      "insert-dive-blue": false,
      "insert-gmt-pepsi": false,
      "insert-dive-small": false,
    });
  });

  it("offers no 'none' option for required slots", () => {
    const ids = evaluateOptions("dialId", BASE_SPEC, fixtureCatalog()).map((option) => option.partId);
    expect(ids).not.toContain(NONE_OPTION_ID);
  });

  it("reports the errors and warnings a choice would cause, involving that slot only", () => {
    const options = evaluateOptions("bezelInsertId", BASE_SPEC, fixtureCatalog());
    const pepsi = options.find((option) => option.partId === "insert-gmt-pepsi");
    expect(pepsi?.issues.map((issue) => [issue.ruleId, issue.severity])).toEqual([["bezel-scale", "warning"]]);
    for (const option of options) {
      expect(option.issues.every((issue) => issue.slots.includes("bezelInsertId") && issue.fixes.length === 0)).toBe(true);
    }
  });

  it("leaves out info issues and issues about other slots", () => {
    const spec = specWith({ strapId: "strap-nato-olive-20" }, { dialText: "Rolex" });
    const gmtDial = evaluateOptions("dialId", spec, fixtureCatalog()).find((option) => option.partId === "dial-gmt-black");
    expect(gmtDial).toEqual({ partId: "dial-gmt-black", compatible: true, issues: [] });
  });

  it("flags a non-printable dial only when there is dial text", () => {
    const withText = specWith({}, { dialText: "Anna" });
    expect(verdicts(evaluateOptions("dialId", withText, fixtureCatalog()))["dial-diver-blue"]).toBe(false);
    expect(verdicts(evaluateOptions("dialId", BASE_SPEC, fixtureCatalog()))["dial-diver-blue"]).toBe(true);
  });

  it("does not modify the spec", () => {
    const spec = structuredClone(BASE_SPEC);
    evaluateOptions("caseId", spec, fixtureCatalog());
    expect(spec).toEqual(BASE_SPEC);
  });
});
