import { describe, expect, it } from "vitest";
import { NONE_OPTION_ID, NO_EXTRAS } from "../catalog";
import type { Catalog, Issue, OptionStatus, OrderExtras, WatchSpec } from "../types";
import { describeChanges, evaluateOptions, evaluateSpareStraps, repairAround, repairKeeping, repairSpec, validateSpec } from ".";
import { BASE_SPEC, byId, FIELD_SPEC, fixtureCatalog, specWith } from "./__fixtures__/catalog";

const BOX = "extra-presentation-box";
const GIFT = "extra-gift-wrap";
const REGULATION = "extra-fine-regulation";

function withExtras(spec: WatchSpec, extras: Partial<OrderExtras>): WatchSpec {
  return { ...spec, extras: { ...NO_EXTRAS, ...extras } };
}

function issuesOf(ruleId: string, spec: WatchSpec, catalog: Catalog = fixtureCatalog()): Issue[] {
  return validateSpec(spec, catalog).issues.filter((issue) => issue.ruleId === ruleId);
}

function applyFix(spec: WatchSpec, fix: Issue["fixes"][number]): WatchSpec {
  return { ...spec, ...fix.patch };
}

describe("a spec with extras", () => {
  it("is judged like one without when the extras are absent, empty or fit", () => {
    const catalog = fixtureCatalog();
    expect(validateSpec(withExtras(BASE_SPEC, {}), catalog)).toEqual({ buildable: true, issues: [] });
    const extras = withExtras(BASE_SPEC, { spareStrapId: "strap-nato-black-22", itemIds: [BOX, GIFT, REGULATION] });
    expect(validateSpec(extras, catalog)).toEqual({ buildable: true, issues: [] });
    expect(validateSpec(withExtras(FIELD_SPEC, { spareStrapId: "strap-leather-brown-20" }), catalog).issues).toEqual([]);
  });
});

describe("spare-strap", () => {
  it("is an error for an unknown id or a part that isn't a strap, naming no slots", () => {
    const [unknown] = issuesOf("spare-strap", withExtras(BASE_SPEC, { spareStrapId: "strap-nope" }));
    expect(unknown).toMatchObject({ severity: "error", slots: [] });
    expect(unknown.message).toContain("couldn't find a strap with the id 'strap-nope'");
    const [dial] = issuesOf("spare-strap", withExtras(BASE_SPEC, { spareStrapId: "dial-diver-black" }));
    expect(dial.message).toMatch(/^'Diver Black' is a dial, not a strap/);
  });

  it("is an error when the spare's width isn't the case's lug width", () => {
    const [issue] = issuesOf("spare-strap", withExtras(BASE_SPEC, { spareStrapId: "strap-nato-olive-20" }));
    expect(issue).toMatchObject({ severity: "error", slots: [] });
    expect(issue.message).toBe(
      "The spare 'Olive NATO 20mm' strap is 20 mm wide, but the 'Diver 42' case has 22 mm lugs, so it would leave gaps at the lugs and slide around on the spring bars.",
    );
    const [wider] = issuesOf("spare-strap", withExtras(FIELD_SPEC, { spareStrapId: "strap-nato-black-22" }));
    expect(wider.message).toContain("so it won't fit between them");
  });

  it("is an error for a bracelet whose end links are shaped for another case", () => {
    const spec = withExtras(specWith({ caseId: "case-diver-display" }), { spareStrapId: "strap-bracelet-diver-22" });
    const [issue] = issuesOf("spare-strap", spec);
    expect(issue.severity).toBe("error");
    expect(issue.message).toContain("solid end links shaped for the 'Diver 42' case");
    expect(issuesOf("spare-strap", withExtras(BASE_SPEC, { spareStrapId: "strap-bracelet-diver-22" }))).toEqual([]);
  });

  it("is only good to know when the spare is the strap the watch comes on", () => {
    const spec = withExtras(BASE_SPEC, { spareStrapId: BASE_SPEC.strapId });
    const report = validateSpec(spec, fixtureCatalog());
    expect(report.buildable).toBe(true);
    const [issue] = report.issues;
    expect(issue).toMatchObject({ ruleId: "spare-strap", severity: "info", slots: [] });
    expect(issue.message).toContain("you'll get two identical straps");
    expect(issue.fixes.map((fix) => fix.description)).toEqual([
      "Use the 'Black NATO 22mm' strap as the spare",
      "Use the 'Diver bracelet 22mm' strap as the spare",
      "Remove the spare strap",
    ]);
  });

  it("offers straps that fit, of another type than the main strap first, then removing the spare", () => {
    const [issue] = issuesOf("spare-strap", withExtras(FIELD_SPEC, { spareStrapId: "strap-nato-black-22" }));
    expect(issue.fixes).toEqual([
      {
        description: "Use the 'Black rubber 20mm' strap as the spare",
        patch: { extras: { spareStrapId: "strap-rubber-black-20", itemIds: [] } },
      },
      {
        description: "Use the 'Brown leather 20mm' strap as the spare",
        patch: { extras: { spareStrapId: "strap-leather-brown-20", itemIds: [] } },
      },
      { description: "Remove the spare strap", patch: { extras: { spareStrapId: null, itemIds: [] } } },
    ]);
  });

  it("offers up to three straps besides removal, never the main strap, keeping the add-ons", () => {
    const catalog = fixtureCatalog();
    const base = catalog.straps[0];
    catalog.straps.push(
      { ...base, id: "strap-canvas-khaki-20", name: "Khaki canvas 20mm", type: "canvas", widthMm: 20, colorHex: "#8a7a55" },
      { ...base, id: "strap-nato-navy-20", name: "Navy NATO 20mm", type: "nato", widthMm: 20, colorHex: "#1f2c44" },
    );
    const spec = withExtras(FIELD_SPEC, { spareStrapId: "strap-nato-black-22", itemIds: [BOX] });
    const [issue] = issuesOf("spare-strap", spec, catalog);
    expect(issue.fixes).toHaveLength(4);
    expect(issue.fixes.at(-1)?.description).toBe("Remove the spare strap");
    const spares = issue.fixes.map((fix) => fix.patch.extras?.spareStrapId);
    expect(spares).not.toContain(FIELD_SPEC.strapId);
    // The main strap is a NATO: the other NATO comes after every other type.
    expect(spares.slice(0, 3)).not.toContain("strap-nato-navy-20");
    for (const fix of issue.fixes) expect(fix.patch.extras?.itemIds).toEqual([BOX]);
  });

  it("gives every fix that resolves the problem without adding an error", () => {
    const catalog = fixtureCatalog();
    const broken = [
      withExtras(BASE_SPEC, { spareStrapId: "strap-nope" }),
      withExtras(BASE_SPEC, { spareStrapId: "strap-nato-olive-20", itemIds: [BOX] }),
      withExtras(specWith({ caseId: "case-diver-display" }), { spareStrapId: "strap-bracelet-diver-22" }),
      withExtras(BASE_SPEC, { spareStrapId: BASE_SPEC.strapId }),
    ];
    for (const spec of broken) {
      const [issue] = issuesOf("spare-strap", spec, catalog);
      expect(issue.fixes.length).toBeGreaterThan(0);
      for (const fix of issue.fixes) {
        const after = validateSpec(applyFix(spec, fix), catalog);
        expect(after.issues.filter((i) => i.ruleId === "spare-strap"), fix.description).toEqual([]);
        expect(after.buildable, fix.description).toBe(true);
      }
    }
  });

  it("has nothing to fit against when the case is unknown, and leaves that to missing-part", () => {
    const spec = withExtras(specWith({ caseId: "case-nope" }), { spareStrapId: "strap-nato-olive-20" });
    expect(issuesOf("spare-strap", spec)).toEqual([]);
  });
});

describe("extras", () => {
  it("is an error for add-ons the workshop doesn't offer, fixed by removing them", () => {
    const spec = withExtras(BASE_SPEC, { itemIds: [BOX, "extra-nope", GIFT] });
    const [issue] = issuesOf("extras", spec);
    expect(issue).toMatchObject({ severity: "error", slots: [] });
    expect(issue.message).toBe("We don't offer an add-on called 'extra-nope', so we can't include it.");
    expect(issue.fixes).toEqual([
      { description: "Remove the unknown add-on", patch: { extras: { spareStrapId: null, itemIds: [BOX, GIFT] } } },
    ]);
  });

  it("points a strap listed as an add-on towards the spare strap", () => {
    const [issue] = issuesOf("extras", withExtras(BASE_SPEC, { itemIds: ["strap-nato-black-22", "extra-nope"] }));
    expect(issue.message).toBe(
      "We don't offer add-ons called 'Black NATO 22mm' (a strap) and 'extra-nope', so we can't include them. A strap goes in as the spare strap instead.",
    );
    expect(issue.fixes[0].description).toBe("Remove the unknown add-ons");
  });

  it("is an error for an add-on listed twice, fixed by keeping one of each", () => {
    const spec = withExtras(BASE_SPEC, { spareStrapId: "strap-nato-black-22", itemIds: [BOX, GIFT, BOX] });
    const [issue] = issuesOf("extras", spec);
    expect(issue.message).toBe("'Presentation box' is listed more than once; each add-on comes once per order.");
    expect(issue.fixes).toEqual([
      {
        description: "Remove the duplicates",
        patch: { extras: { spareStrapId: "strap-nato-black-22", itemIds: [BOX, GIFT] } },
      },
    ]);
  });
});

describe("repairing extras", () => {
  it("fixes a spare strap and unknown add-ons like any other error, describing each step", () => {
    const spec = withExtras(FIELD_SPEC, { spareStrapId: "strap-nato-black-22", itemIds: ["extra-nope", BOX, BOX] });
    const result = repairSpec(spec, fixtureCatalog());
    expect(result.report).toEqual({ buildable: true, issues: [] });
    expect(result.spec.extras).toEqual({ spareStrapId: "strap-rubber-black-20", itemIds: [BOX] });
    expect(result.changes).toEqual([
      "Spare strap: Black NATO 22mm → Black rubber 20mm",
      "Removed: unknown add-on 'extra-nope'",
      "Removed: duplicate Presentation box",
    ]);
  });

  it("moves the spare strap along when a fix changes the case to one it doesn't fit", () => {
    // The dial only fits the exhibition case, and the spare bracelet's end links only fit the other one.
    const catalog = fixtureCatalog();
    byId(catalog.dials, "dial-diver-black").diameterMm = 28.8;
    Object.assign(byId(catalog.cases, "case-diver-display"), { dialDiameterMm: 28.8, caseback: "solid" });
    const spec = withExtras(BASE_SPEC, { spareStrapId: "strap-bracelet-diver-22", itemIds: [BOX] });

    // The case fix is still offered although it leaves the spare strap behind...
    const [dialSize] = issuesOf("dial-size", spec, catalog);
    const caseFix = dialSize.fixes.find((fix) => fix.patch.caseId === "case-diver-display");
    expect(caseFix).toBeDefined();
    const [spareIssue] = issuesOf("spare-strap", applyFix(spec, caseFix!), catalog);
    expect(spareIssue.severity).toBe("error");

    // ...and keeping the dial the customer chose, the repair takes the case and then a spare that fits.
    const result = repairKeeping(spec, ["dialId"], catalog);
    expect(result.report.buildable).toBe(true);
    expect(result.spec).toMatchObject({
      dialId: "dial-diver-black",
      caseId: "case-diver-display",
      extras: { spareStrapId: "strap-nato-black-22", itemIds: [BOX] },
    });
    expect(result.changes).toEqual([
      "Case: Diver 42 → Diver 42 Exhibition",
      "Spare strap: Diver bracelet 22mm → Black NATO 22mm",
    ]);
  });

  it("never treats the extras as a locked part", () => {
    const spec = withExtras(FIELD_SPEC, { spareStrapId: "strap-nato-black-22" });
    const all = ["movementId", "caseId", "dialId", "handsId", "crystalId", "bezelInsertId", "strapId"] as const;
    const result = repairAround(spec, all, fixtureCatalog());
    expect(result.report.buildable).toBe(true);
    expect(result.changes).toEqual(["Spare strap: Black NATO 22mm → Black rubber 20mm"]);
  });

  it("keeps the extras through a repair of the watch", () => {
    const spec = withExtras(specWith({ crystalId: "crystal-sapphire-320" }), { spareStrapId: "strap-nato-black-22", itemIds: [GIFT] });
    const result = repairSpec(spec, fixtureCatalog());
    expect(result.report.buildable).toBe(true);
    expect(result.spec.extras).toEqual(spec.extras);
  });
});

describe("describeChanges for extras", () => {
  const catalog = fixtureCatalog();

  it("names the spare strap and each add-on added or removed, in catalogue order", () => {
    const before = withExtras(BASE_SPEC, { itemIds: [GIFT] });
    const after = withExtras(BASE_SPEC, { spareStrapId: "strap-nato-black-22", itemIds: [REGULATION, BOX] });
    expect(describeChanges(before, after, catalog)).toEqual([
      "Spare strap: none → Black NATO 22mm",
      "Added: Presentation box",
      "Removed: Gift wrapping and card",
      "Added: Fine regulation",
    ]);
    expect(describeChanges(after, BASE_SPEC, catalog)).toEqual([
      "Spare strap: Black NATO 22mm → none",
      "Removed: Presentation box",
      "Removed: Fine regulation",
    ]);
  });

  it("reads absent extras as none, and ignores the order of the add-ons", () => {
    expect(describeChanges(BASE_SPEC, withExtras(BASE_SPEC, {}), catalog)).toEqual([]);
    expect(describeChanges(withExtras(BASE_SPEC, { itemIds: [BOX, GIFT] }), withExtras(BASE_SPEC, { itemIds: [GIFT, BOX] }), catalog)).toEqual([]);
  });

  it("names unknown ids as such", () => {
    const after = withExtras(BASE_SPEC, { spareStrapId: "strap-nope", itemIds: ["extra-nope"] });
    expect(describeChanges(BASE_SPEC, after, catalog)).toEqual([
      "Spare strap: none → unknown part 'strap-nope'",
      "Added: unknown add-on 'extra-nope'",
    ]);
  });
});

function verdicts(options: OptionStatus[]): Record<string, boolean> {
  return Object.fromEntries(options.map((option) => [option.partId, option.compatible]));
}

describe("evaluateSpareStraps", () => {
  it("starts with 'none', then every strap in catalogue order, judged against the case", () => {
    const catalog = fixtureCatalog();
    const options = evaluateSpareStraps(BASE_SPEC, catalog);
    expect(options.map((option) => option.partId)).toEqual([NONE_OPTION_ID, ...catalog.straps.map((strap) => strap.id)]);
    expect(verdicts(options)).toEqual({
      [NONE_OPTION_ID]: true,
      "strap-rubber-black-22": true,
      "strap-rubber-black-20": false,
      "strap-nato-olive-20": false,
      "strap-leather-brown-20": false,
      "strap-nato-black-22": true,
      "strap-bracelet-diver-22": true,
    });
    expect(verdicts(evaluateSpareStraps(specWith({ caseId: "case-diver-display" }), catalog))["strap-bracelet-diver-22"]).toBe(false);
  });

  it("reports the spare-strap errors a choice would cause, without fixes, and not the identical-strap note", () => {
    const options = evaluateSpareStraps(FIELD_SPEC, fixtureCatalog());
    const wide = options.find((option) => option.partId === "strap-nato-black-22");
    expect(wide?.issues.map((issue) => [issue.ruleId, issue.severity, issue.fixes.length])).toEqual([["spare-strap", "error", 0]]);
    expect(options.find((option) => option.partId === FIELD_SPEC.strapId)).toEqual({ partId: FIELD_SPEC.strapId, compatible: true, issues: [] });
  });

  it("ignores the spare strap already chosen and doesn't modify the spec", () => {
    const spec = withExtras(BASE_SPEC, { spareStrapId: "strap-nope", itemIds: [BOX] });
    const copy = structuredClone(spec);
    expect(verdicts(evaluateSpareStraps(spec, fixtureCatalog()))).toEqual(verdicts(evaluateSpareStraps(BASE_SPEC, fixtureCatalog())));
    expect(spec).toEqual(copy);
  });
});

describe("the part pickers", () => {
  it("aren't affected by the extras, which name no slots", () => {
    const catalog = fixtureCatalog();
    const spec = withExtras(BASE_SPEC, { spareStrapId: "strap-bracelet-diver-22", itemIds: ["extra-nope"] });
    expect(evaluateOptions("caseId", spec, catalog)).toEqual(evaluateOptions("caseId", BASE_SPEC, catalog));
    expect(evaluateOptions("strapId", spec, catalog)).toEqual(evaluateOptions("strapId", BASE_SPEC, catalog));
  });
});
