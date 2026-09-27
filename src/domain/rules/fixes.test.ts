import { describe, expect, it } from "vitest";
import { CATALOG, partsForSlot, SLOTS, TEMPLATES } from "../catalog";
import type { Catalog, Issue, ValidationReport, WatchSpec } from "../types";
import { validateSpec } from ".";
import { BASE_SPEC, byId, FIELD_SPEC, fixtureCatalog, specWith } from "./__fixtures__/catalog";
import { collectFindings } from "./engine";

function applyFix(spec: WatchSpec, fix: Issue["fixes"][number]): WatchSpec {
  return { ...spec, ...fix.patch };
}

function countBy(report: ValidationReport, match: (issue: Issue) => boolean): number {
  return report.issues.filter(match).length;
}

function issueOf(ruleId: string, spec: WatchSpec, catalog: Catalog = fixtureCatalog()): Issue {
  const issue = validateSpec(spec, catalog).issues.find((i) => i.ruleId === ruleId);
  if (!issue) throw new Error(`Expected a ${ruleId} issue`);
  return issue;
}

const BROKEN_SPECS: [string, WatchSpec][] = [
  ["empty dial", specWith({ dialId: "" })],
  ["unknown case", specWith({ caseId: "case-nope" })],
  ["unknown insert", specWith({ bezelInsertId: "insert-nope" })],
  ["dress dial in a dive case", specWith({ dialId: "dial-dress-silver" })],
  ["field dial in a dive case", specWith({ dialId: "dial-field-cream" })],
  ["date dial on a no-date movement", specWith({ movementId: "mv-nodate" })],
  ["phantom date", specWith({ dialId: "dial-diver-black-nodate" })],
  ["GMT movement without GMT hand", specWith({ movementId: "mv-gmt" })],
  ["GMT hand without GMT pinion", specWith({ handsId: "hands-gmt" })],
  ["hands too long", specWith({ handsId: "hands-dauphine-dress" })],
  ["crystal too big", specWith({ crystalId: "crystal-sapphire-320" })],
  ["missing insert", specWith({ bezelInsertId: null })],
  ["insert too small", specWith({ bezelInsertId: "insert-dive-small" })],
  ["insert without a seat", { ...FIELD_SPEC, bezelInsertId: "insert-dive-black" }],
  ["dive insert on a 24h bezel", specWith({ caseId: "case-gmt", strapId: "strap-rubber-black-20" })],
  ["narrow strap", specWith({ strapId: "strap-nato-olive-20" })],
  ["bracelet for another case", specWith({ caseId: "case-diver-display", strapId: "strap-bracelet-diver-22" })],
  ["brand on a non-printable dial", specWith({ dialId: "dial-diver-blue" }, { dialText: "ROLEX" })],
  ["engraving on a display back", specWith({ caseId: "case-diver-display" }, { casebackEngraving: "For Anna" })],
  [
    "many problems at once",
    specWith(
      { movementId: "mv-gmt", dialId: "dial-field-cream", crystalId: "crystal-sapphire-320", strapId: "" },
      { dialText: "Swiss Made!", casebackEngraving: "x".repeat(70) },
    ),
  ],
];

describe("every suggested fix", () => {
  it.each(BROKEN_SPECS)("resolves its issue without adding errors (or warnings, for a warning): %s", (_name, spec) => {
    const catalog = fixtureCatalog();
    const before = validateSpec(spec, catalog);
    const withFixes = before.issues.filter((issue) => issue.fixes.length > 0);
    expect(withFixes.length).toBeGreaterThan(0);

    for (const issue of withFixes) {
      expect(issue.fixes.length).toBeLessThanOrEqual(3);
      for (const fix of issue.fixes) {
        const after = validateSpec(applyFix(spec, fix), catalog);
        const sameProblem = (i: Issue) => i.ruleId === issue.ruleId && i.severity === issue.severity;
        expect(countBy(after, sameProblem), fix.description).toBeLessThan(countBy(before, sameProblem));
        const guarded = issue.severity === "warning" ? ["error", "warning"] : ["error"];
        for (const other of after.issues.filter((i) => guarded.includes(i.severity))) {
          const sameRule = (i: Issue) => i.severity === other.severity && i.ruleId === other.ruleId;
          expect(countBy(after, sameRule), fix.description).toBeLessThanOrEqual(countBy(before, sameRule));
        }
      }
    }
  });

  // The real parts library, keyed by each finding's exact condition rather than its rule: every template
  // with every part swapped into every slot, one at a time.
  it.each(TEMPLATES.map((template) => [template.id, template.spec] as const))(
    "resolves exactly its own finding on the real catalogue, for every single-part swap of %s",
    (_id, template) => {
      for (const { slot } of SLOTS) {
        for (const part of partsForSlot(slot)) {
          const spec: WatchSpec = { ...template, [slot]: part.id };
          const findings = collectFindings(spec, CATALOG);
          const { issues } = validateSpec(spec);
          const errorsBefore = new Set(findings.filter((f) => f.severity === "error").map((f) => f.key));
          findings.forEach((target, index) => {
            for (const fix of issues[index].fixes) {
              const after = collectFindings(applyFix(spec, fix), CATALOG);
              const label = `${target.key} in ${slot}=${part.id}: ${fix.description}`;
              expect(after.map((f) => f.key), label).not.toContain(target.key);
              const newErrors = after.filter((f) => f.severity === "error" && !errorsBefore.has(f.key));
              expect(newErrors.map((f) => f.key), label).toEqual([]);
            }
          });
        }
      }
    },
  );

  it("is a short imperative sentence naming the part", () => {
    const { fixes } = issueOf("strap-width", specWith({ strapId: "strap-nato-olive-20" }));
    expect(fixes.map((fix) => fix.description)).toEqual([
      "Use the 'Black NATO 22mm' strap",
      "Use the 'Black rubber 22mm' strap",
      "Use the 'Diver bracelet 22mm' strap",
    ]);
  });
});

describe("fix ranking", () => {
  it("prefers the same type and a close colour", () => {
    const { fixes } = issueOf("strap-width", specWith({ strapId: "strap-nato-olive-20" }));
    expect(fixes[0].patch).toEqual({ strapId: "strap-nato-black-22" });
  });

  it("prefers the cheaper of two equally similar parts", () => {
    const catalog = fixtureCatalog();
    for (const [id, costEur] of [
      ["strap-nato-black-22", 9],
      ["strap-rubber-black-22", 5],
    ] as const) {
      Object.assign(byId(catalog.straps, id), { type: "nato", colorHex: "#4b5320", costEur });
    }
    const { fixes } = issueOf("strap-width", specWith({ strapId: "strap-nato-olive-20" }), catalog);
    expect(fixes[0].patch).toEqual({ strapId: "strap-rubber-black-22" });
  });

  it("changes the smaller part first and offers the bigger part as an alternative", () => {
    const catalog = fixtureCatalog();
    byId(catalog.dials, "dial-diver-black").diameterMm = 28.8;
    Object.assign(byId(catalog.cases, "case-diver-display"), { dialDiameterMm: 28.8, caseback: "solid" });
    const { fixes } = issueOf("dial-size", BASE_SPEC, catalog);
    expect(fixes.map((fix) => Object.keys(fix.patch)[0])).toEqual(["dialId", "dialId", "caseId"]);
    expect(fixes[2]).toEqual({ description: "Use the 'Diver 42 Exhibition' case", patch: { caseId: "case-diver-display" } });
  });

  it("offers a movement first for a phantom date, keeping the chosen dial", () => {
    const { severity, fixes } = issueOf("date-window", specWith({ dialId: "dial-diver-black-nodate" }));
    expect(severity).toBe("warning");
    expect(fixes[0]).toEqual({ description: "Use the 'NH38A automatic' movement", patch: { movementId: "mv-nodate" } });
  });
});

describe("removal fixes", () => {
  it("clears text that can't be printed anywhere", () => {
    const spec = specWith({}, { dialText: "Tag Heuer", casebackEngraving: "For Anna" });
    expect(issueOf("dial-text", spec).fixes).toEqual([
      {
        description: "Remove the dial text",
        patch: { personalization: { dialText: "", casebackEngraving: "For Anna" } },
      },
    ]);
  });

  it("offers printable dials, then clearing the text, for a non-printable dial", () => {
    const { fixes } = issueOf("dial-text", specWith({ dialId: "dial-diver-blue" }, { dialText: "Anna" }));
    expect(fixes.map((fix) => fix.description)).toEqual([
      "Use the 'Diver Black' dial",
      "Use the 'Diver Black No-Date' dial",
      "Remove the dial text",
    ]);
  });

  it("offers a solid-back case, then clearing the engraving, for a display caseback", () => {
    const spec = specWith({ caseId: "case-diver-display" }, { casebackEngraving: "For Anna" });
    const { fixes } = issueOf("caseback-engraving", spec);
    expect(fixes.map((fix) => fix.description)).toEqual(["Use the 'Diver 42' case", "Remove the caseback engraving"]);
  });

  it("removes an insert the case has no seat for", () => {
    const { fixes } = issueOf("bezel-insert", { ...FIELD_SPEC, bezelInsertId: "insert-dive-black" });
    expect(fixes[0]).toEqual({ description: "Remove the bezel insert", patch: { bezelInsertId: null } });
  });

  it("adds an insert when the bezel needs one", () => {
    const { fixes } = issueOf("bezel-insert", specWith({ bezelInsertId: null }));
    expect(fixes.map((fix) => fix.description)).toEqual([
      "Add the 'Dive 60 Black' bezel insert",
      "Add the 'Dive 60 Blue' bezel insert",
      "Add the 'GMT 24 Pepsi' bezel insert",
    ]);
  });

  it("does not offer removing an unknown insert when the bezel needs one", () => {
    const { fixes } = issueOf("missing-part", specWith({ bezelInsertId: "insert-nope" }));
    expect(fixes.map((fix) => fix.patch.bezelInsertId)).toEqual(["insert-dive-black", "insert-dive-blue", "insert-gmt-pepsi"]);
    const onField = issueOf("missing-part", { ...FIELD_SPEC, bezelInsertId: "insert-nope" });
    expect(onField.fixes).toEqual([{ description: "Remove the bezel insert", patch: { bezelInsertId: null } }]);
  });
});

describe("issues without fixes", () => {
  it("gives info issues no fixes", () => {
    const report = validateSpec(specWith({ handsId: "hands-mercedes-blue-lume", dialId: "dial-gmt-black" }), fixtureCatalog());
    expect(report.issues.filter((issue) => issue.severity === "info").map((issue) => issue.fixes)).toEqual([[], []]);
  });

  it("gives no fix when nothing in the catalogue resolves the issue", () => {
    const catalog = fixtureCatalog();
    for (const hands of catalog.hands) hands.holesMm.minute = 1;
    expect(issueOf("hand-fit", BASE_SPEC, catalog).fixes).toEqual([]);
  });
});
