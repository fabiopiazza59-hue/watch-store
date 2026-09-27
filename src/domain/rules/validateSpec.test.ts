import { describe, expect, it } from "vitest";
import type { Catalog, Issue, MovementFamily, SlotKey, WatchSpec } from "../types";
import { resolveSpec } from "../catalog";
import { fitDialText } from "../dialTextFit";
import { normalizePersonalizationText, validateSpec } from ".";
import { BASE_SPEC, byId, FIELD_SPEC, fixtureCatalog, specWith } from "./__fixtures__/catalog";

function issuesOf(ruleId: string, spec: WatchSpec, catalog: Catalog = fixtureCatalog()): Issue[] {
  return validateSpec(spec, catalog).issues.filter((issue) => issue.ruleId === ruleId);
}

function severitiesOf(ruleId: string, spec: WatchSpec, catalog?: Catalog): string[] {
  return issuesOf(ruleId, spec, catalog).map((issue) => issue.severity);
}

const GMT_SPEC = specWith({ movementId: "mv-gmt", handsId: "hands-gmt" });

describe("a well-matched spec", () => {
  it("is buildable with no issues at all", () => {
    expect(validateSpec(BASE_SPEC, fixtureCatalog())).toEqual({ buildable: true, issues: [] });
    expect(validateSpec(FIELD_SPEC, fixtureCatalog())).toEqual({ buildable: true, issues: [] });
  });
});

describe("missing-part", () => {
  it.each<SlotKey>(["movementId", "caseId", "dialId", "handsId", "crystalId", "strapId"])(
    "is an error when %s is empty",
    (slot) => {
      const [issue] = issuesOf("missing-part", specWith({ [slot]: "" }));
      expect(issue).toMatchObject({ severity: "error", slots: [slot] });
    },
  );

  it("explains an empty, an unknown and a wrong-category id", () => {
    expect(issuesOf("missing-part", specWith({ dialId: "" }))[0].message).toMatch(/^No dial chosen yet/);
    expect(issuesOf("missing-part", specWith({ dialId: "dial-nope" }))[0].message).toContain(
      "couldn't find a dial with the id 'dial-nope'",
    );
    expect(issuesOf("missing-part", specWith({ dialId: "strap-rubber-black-22" }))[0].message).toContain(
      "'Black rubber 22mm' is a strap, not a dial",
    );
  });

  it("accepts no bezel insert but rejects an unknown one", () => {
    expect(issuesOf("missing-part", FIELD_SPEC)).toEqual([]);
    const [issue] = issuesOf("missing-part", { ...FIELD_SPEC, bezelInsertId: "insert-nope" });
    expect(issue).toMatchObject({ severity: "error", slots: ["bezelInsertId"] });
  });

  it("does not run rules that need the missing part", () => {
    const report = validateSpec(specWith({ dialId: "" }), fixtureCatalog());
    expect(report.issues.map((issue) => issue.ruleId)).toEqual(["missing-part"]);
  });
});

describe("movement-family", () => {
  const otherFamily = "NH4x" as string as MovementFamily;

  it.each([
    ["cases", "case-diver", "caseId"],
    ["dials", "dial-diver-black", "dialId"],
    ["hands", "hands-mercedes-silver", "handsId"],
  ] as const)("is an error when the %s part is made for another family", (key, id, slot) => {
    const catalog = fixtureCatalog();
    byId<{ id: string; movementFamily: MovementFamily }>(catalog[key], id).movementFamily = otherFamily;
    const [issue] = issuesOf("movement-family", BASE_SPEC, catalog);
    expect(issue).toMatchObject({ severity: "error", slots: [slot, "movementId"] });
    expect(issue.message).toContain("NH4x");
  });

  it("passes when every part matches the movement's family", () => {
    expect(issuesOf("movement-family", BASE_SPEC)).toEqual([]);
  });
});

describe("dial-size", () => {
  it.each([
    [28.7, false],
    [28.71, true],
    [28.3, false],
    [28.29, true],
  ])("a %f mm dial in a 28.5 mm seat: error %s", (diameter, isError) => {
    const catalog = fixtureCatalog();
    byId(catalog.dials, "dial-diver-black").diameterMm = diameter;
    expect(severitiesOf("dial-size", BASE_SPEC, catalog)).toEqual(isError ? ["error"] : []);
  });

  it("names the parts and sizes", () => {
    const catalog = fixtureCatalog();
    byId(catalog.dials, "dial-diver-black").diameterMm = 30;
    expect(issuesOf("dial-size", BASE_SPEC, catalog)[0].message).toBe(
      "The 'Diver 42' case takes a 28.5 mm dial; the 'Diver Black' dial is 30.0 mm, 1.5 mm too big, so it won't seat.",
    );
    byId(catalog.dials, "dial-diver-black").diameterMm = 28.2;
    expect(issuesOf("dial-size", BASE_SPEC, catalog)[0].message).toContain("0.3 mm too small");
  });
});

describe("dial-crown-position", () => {
  it("is an error when the dial is made for another crown position", () => {
    const [issue] = issuesOf("dial-crown-position", specWith({ dialId: "dial-field-cream" }));
    expect(issue).toMatchObject({ severity: "error", slots: ["dialId", "caseId"] });
    expect(issue.message).toContain("crown at 3 o'clock");
    // The 3.8 position reads as "about 4 o'clock", without collector jargon.
    expect(issue.message).toContain("crown at about 4 o'clock");
    expect(issue.message).not.toMatch(/SKX|3\.8/);
  });

  it("passes when crown positions match", () => {
    expect(issuesOf("dial-crown-position", BASE_SPEC)).toEqual([]);
    expect(issuesOf("dial-crown-position", FIELD_SPEC)).toEqual([]);
  });
});

describe("date-window", () => {
  it.each([
    ["dial-diver-black", "mv-nodate", ["error"]],
    ["dial-diver-daydate", "mv-date", ["error"]],
    ["dial-diver-daydate", "mv-nodate", ["error"]],
    ["dial-diver-black-nodate", "mv-date", ["warning"]],
    ["dial-diver-black", "mv-daydate", ["warning"]],
    ["dial-diver-black", "mv-date", []],
    ["dial-diver-black-nodate", "mv-nodate", []],
    ["dial-diver-daydate", "mv-daydate", []],
  ])("%s on %s: %j", (dialId, movementId, expected) => {
    expect(severitiesOf("date-window", specWith({ dialId, movementId }))).toEqual(expected);
  });

  it("explains the phantom date", () => {
    const [issue] = issuesOf("date-window", specWith({ dialId: "dial-diver-black-nodate" }));
    expect(issue.message).toContain("phantom");
    expect(issue.slots).toEqual(["dialId", "movementId"]);
  });

  it("says a date window on a movement without a date wheel would show bare movement", () => {
    const [issue] = issuesOf("date-window", specWith({ movementId: "mv-nodate" }));
    expect(issue.message).toContain("has no date wheel, so the window would open onto bare movement");
    expect(issue.message).not.toContain("disc");
  });
});

describe("dial-center-hole", () => {
  it("is an error when a GMT movement gets a standard dial, with a GMT-ready dial as the first fix", () => {
    const [issue] = issuesOf("dial-center-hole", GMT_SPEC);
    expect(issue).toMatchObject({ severity: "error", slots: ["dialId", "movementId"] });
    expect(issue.message).toContain("NH34A's 24-hour wheel needs a dial centre hole of at least 2.7 mm");
    expect(issue.message).toContain("'Diver Black' dial's hole is 2.05 mm");
    expect(issue.fixes[0]).toMatchObject({ patch: { dialId: "dial-gmt-black" } });
    expect(issuesOf("dial-center-hole", { ...GMT_SPEC, dialId: "dial-gmt-black" })).toEqual([]);
  });

  it("accepts a GMT-ready dial on a three-hand movement", () => {
    expect(issuesOf("dial-center-hole", specWith({ dialId: "dial-gmt-black" }))).toEqual([]);
  });

  it.each([
    [2.7, []],
    [2.69, ["error"]],
  ])("a %f mm hole on the 2.2 mm GMT pinion: %j", (hole, expected) => {
    const catalog = fixtureCatalog();
    byId(catalog.dials, "dial-gmt-black").centerHoleMm = hole;
    expect(severitiesOf("dial-center-hole", { ...GMT_SPEC, dialId: "dial-gmt-black" }, catalog)).toEqual(expected);
  });

  it("checks the hour wheel on a three-hand movement too", () => {
    const catalog = fixtureCatalog();
    byId(catalog.dials, "dial-diver-black").centerHoleMm = 1.9;
    expect(issuesOf("dial-center-hole", BASE_SPEC, catalog)[0].message).toContain("hour wheel needs a dial centre hole of at least 2.0 mm");
  });
});

describe("hand-fit", () => {
  it.each([
    ["minute", 0.92, false],
    ["minute", 0.93, true],
    ["minute", 0.88, false],
    ["hour", 1.47, true],
    ["seconds", 0.22, false],
    ["seconds", 0.23, true],
  ] as const)("%s hole %f mm: error %s", (hand, hole, isError) => {
    const catalog = fixtureCatalog();
    byId(catalog.hands, "hands-mercedes-silver").holesMm[hand] = hole;
    expect(severitiesOf("hand-fit", BASE_SPEC, catalog)).toEqual(isError ? ["error"] : []);
  });

  it("names the hole and pinion sizes", () => {
    const catalog = fixtureCatalog();
    byId(catalog.hands, "hands-mercedes-silver").holesMm.minute = 1;
    expect(issuesOf("hand-fit", BASE_SPEC, catalog)[0].message).toContain(
      "the minute hand's hole is 1.00 mm but its pinion is 0.90 mm",
    );
  });
});

describe("gmt-hand", () => {
  it("is an error when a GMT movement gets no GMT hand", () => {
    const [issue] = issuesOf("gmt-hand", specWith({ movementId: "mv-gmt" }));
    expect(issue).toMatchObject({ severity: "error", slots: ["handsId", "movementId"] });
    expect(issue.message).toContain("no GMT hand");
  });

  it("is an error when a GMT hand has no pinion, explained without jargon and naming the way out", () => {
    const { message } = issuesOf("gmt-hand", specWith({ handsId: "hands-gmt" }))[0];
    expect(message).toContain("no fourth (24-hour) hand to fit it to");
    expect(message).not.toContain("pinion");
    const gmt = byId(fixtureCatalog().movements, "mv-gmt").caliber;
    expect(message).toContain(`Choose the ${gmt} GMT movement or hands without a GMT hand.`);
  });

  it.each([
    [2.22, []],
    [2.23, ["error"]],
  ])("GMT hole %f mm on a 2.2 mm pinion: %j", (hole, expected) => {
    const catalog = fixtureCatalog();
    byId(catalog.hands, "hands-gmt").holesMm.gmt = hole;
    expect(severitiesOf("gmt-hand", GMT_SPEC, catalog)).toEqual(expected);
  });
});

describe("hand-length", () => {
  // Diver dial: 28.5 mm, so radius 14.25 mm, longest allowed hand 13.95 mm, shortest minute hand 10.6875 mm.
  it.each([
    ["minute", 13.95, []],
    ["minute", 13.96, ["error"]],
    ["seconds", 13.95, []],
    ["seconds", 13.96, ["error"]],
    ["minute", 10.6875, []],
    ["minute", 10.68, ["warning"]],
  ] as const)("%s hand %f mm: %j", (hand, length, expected) => {
    const catalog = fixtureCatalog();
    byId(catalog.hands, "hands-mercedes-silver").lengthsMm[hand] = length;
    expect(severitiesOf("hand-length", BASE_SPEC, catalog)).toEqual(expected);
  });

  it("explains how far the hands may reach", () => {
    const [issue] = issuesOf("hand-length", specWith({ handsId: "hands-dauphine-dress" }));
    expect(issue.message).toContain("at most 13.95 mm");
    expect(issue.message).toContain("the seconds hand is 14.2 mm");
  });
});

describe("crystal-fit", () => {
  // Crystals come in 0.1 mm steps, and one step off won't seal.
  it.each([
    [31.55, false],
    [31.56, true],
    [31.6, true],
    [31.45, false],
    [31.44, true],
    [31.4, true],
  ])("a %f mm crystal in a 31.5 mm seat: error %s", (diameter, isError) => {
    const catalog = fixtureCatalog();
    byId(catalog.crystals, "crystal-sapphire-315").diameterMm = diameter;
    expect(severitiesOf("crystal-fit", BASE_SPEC, catalog)).toEqual(isError ? ["error"] : []);
  });

  it("names the parts and sizes", () => {
    expect(issuesOf("crystal-fit", specWith({ crystalId: "crystal-sapphire-320" }))[0].message).toBe(
      "The 'Diver 42' case takes a 31.5 mm crystal; the 'Sapphire domed 32mm' crystal is 32.0 mm, " +
        "0.5 mm too big, so it won't press into the case.",
    );
  });
});

describe("bezel-insert", () => {
  it("is an error when an insert bezel has no insert", () => {
    const [issue] = issuesOf("bezel-insert", specWith({ bezelInsertId: null }));
    expect(issue).toMatchObject({ severity: "error", slots: ["bezelInsertId", "caseId"] });
    expect(issue.message).toContain("38.0 × 30.5 mm");
  });

  it("is an error when an insert is fitted to a case without an insert bezel", () => {
    const [issue] = issuesOf("bezel-insert", { ...FIELD_SPEC, bezelInsertId: "insert-dive-black" });
    expect(issue.message).toContain("nowhere to fit");
  });

  it.each([
    ["outerMm", 38.1, false],
    ["outerMm", 38.11, true],
    ["innerMm", 30.4, false],
    ["innerMm", 30.39, true],
  ] as const)("insert %s %f mm on a 38 × 30.5 mm seat: error %s", (dimension, size, isError) => {
    const catalog = fixtureCatalog();
    byId(catalog.bezelInserts, "insert-dive-black")[dimension] = size;
    expect(severitiesOf("bezel-insert", BASE_SPEC, catalog)).toEqual(isError ? ["error"] : []);
  });

  it("passes with no insert on a fixed bezel", () => {
    expect(issuesOf("bezel-insert", FIELD_SPEC)).toEqual([]);
  });
});

describe("bezel-scale", () => {
  const gmtCase = specWith({ caseId: "case-gmt", strapId: "strap-rubber-black-20" });

  it("warns about a non-24h insert on a 24h bezel", () => {
    expect(severitiesOf("bezel-scale", gmtCase)).toEqual(["warning"]);
    expect(severitiesOf("bezel-scale", { ...gmtCase, bezelInsertId: "insert-gmt-pepsi" })).toEqual([]);
  });

  it("warns about a 24h insert on a dive bezel", () => {
    expect(severitiesOf("bezel-scale", specWith({ bezelInsertId: "insert-gmt-pepsi" }))).toEqual(["warning"]);
  });

  it("warns when a GMT hand has no 24h scale to read against", () => {
    const [issue] = issuesOf("bezel-scale", GMT_SPEC);
    expect(issue).toMatchObject({ severity: "warning", slots: ["movementId", "dialId", "bezelInsertId"] });
    expect(issue.message).toContain("nothing to read the second time zone against");
    expect(issuesOf("bezel-scale", { ...GMT_SPEC, dialId: "dial-gmt-black" })).toEqual([]);
  });
});

describe("strap-width", () => {
  it("is an error when the strap is narrower or wider than the lugs", () => {
    const [narrow] = issuesOf("strap-width", specWith({ strapId: "strap-nato-olive-20" }));
    expect(narrow).toMatchObject({ severity: "error", slots: ["strapId", "caseId"] });
    expect(narrow.message).toContain("22 mm lugs; the 'Olive NATO 20mm' strap is 20 mm wide");
    const [wide] = issuesOf("strap-width", { ...FIELD_SPEC, strapId: "strap-rubber-black-22" });
    expect(wide.message).toContain("won't fit between them");
  });

  it("is an error when fitted end links are made for another case", () => {
    const bracelet = { strapId: "strap-bracelet-diver-22" };
    expect(issuesOf("strap-width", specWith(bracelet))).toEqual([]);
    const [issue] = issuesOf("strap-width", specWith({ ...bracelet, caseId: "case-diver-display" }));
    expect(issue.message).toContain("end links shaped for the 'Diver 42' case");
  });
});

describe("hand-clearance", () => {
  const GMT_WITH_GMT_DIAL = { ...GMT_SPEC, dialId: "dial-gmt-black" };

  /** The fixture catalogue with the diver case sold NH34-ready for `readyWith` and the given GMT hand and crystal. */
  function gmtCatalog({ readyWith, crystal = "flat", seconds = 13 }: {
    readyWith?: ("flat" | "domed" | "double-dome")[];
    crystal?: "flat" | "domed" | "double-dome";
    seconds?: number;
  }): Catalog {
    const catalog = fixtureCatalog();
    byId(catalog.cases, "case-diver").nh34ReadyCrystals = readyWith;
    byId(catalog.crystals, "crystal-sapphire-315").shape = crystal;
    byId(catalog.hands, "hands-gmt").lengthsMm.seconds = seconds;
    return catalog;
  }

  describe("tight stack", () => {
    it.each([
      [1.59, ["warning"]],
      [1.6, []],
    ])("GMT stack with %f mm clearance: %j", (clearance, expected) => {
      const catalog = gmtCatalog({ readyWith: ["flat"] });
      byId(catalog.cases, "case-diver").handClearanceMm = clearance;
      expect(severitiesOf("hand-clearance", GMT_WITH_GMT_DIAL, catalog)).toEqual(expected);
    });

    it("ignores three-hand movements", () => {
      const catalog = fixtureCatalog();
      byId(catalog.cases, "case-diver").handClearanceMm = 1.2;
      expect(issuesOf("hand-clearance", BASE_SPEC, catalog)).toEqual([]);
    });
  });

  describe("seconds hand against the crystal", () => {
    it.each<[string, Parameters<typeof gmtCatalog>[0], string[]]>([
      ["a 13 mm seconds hand under a flat crystal", {}, ["warning"]],
      ["a 12 mm seconds hand under a flat crystal", { seconds: 12 }, ["warning"]],
      ["an 11.9 mm seconds hand under a flat crystal", { seconds: 11.9 }, []],
      ["a 13 mm seconds hand under a single-domed crystal", { crystal: "domed" }, ["warning"]],
      ["a 13 mm seconds hand under a double-dome", { crystal: "double-dome" }, ["warning"]],
      ["a 12.5 mm seconds hand under a double-dome", { crystal: "double-dome", seconds: 12.5 }, []],
      ["a flat crystal in a case sold NH34-ready with it", { readyWith: ["flat"] }, []],
      ["a flat crystal in a case sold NH34-ready only with a double-dome", { readyWith: ["double-dome"] }, ["warning"]],
      ["a double-dome in a case sold NH34-ready with it", { readyWith: ["double-dome"], crystal: "double-dome" }, []],
    ])("%s: %j", (_, setup, expected) => {
      expect(severitiesOf("hand-clearance", GMT_WITH_GMT_DIAL, gmtCatalog(setup))).toEqual(expected);
    });

    it("names the seconds hand, the crystal and the limit, and involves all four parts", () => {
      const [flat] = issuesOf("hand-clearance", GMT_WITH_GMT_DIAL, gmtCatalog({}));
      expect(flat.message).toContain("The 'GMT Arrow' seconds hand is 13 mm long");
      expect(flat.message).toContain("isn't sold NH34-ready with the 'Sapphire flat 31.5mm' crystal");
      expect(flat.message).toContain("shorter than 12 mm unless the crystal is double-domed");
      expect(flat.slots).toEqual(["crystalId", "handsId", "caseId", "movementId"]);

      const [doubleDome] = issuesOf("hand-clearance", GMT_WITH_GMT_DIAL, gmtCatalog({ crystal: "double-dome" }));
      expect(doubleDome.message).toContain("even a double-dome crystal only clears a seconds hand up to 12.5 mm");
    });

    it("ignores three-hand movements", () => {
      expect(issuesOf("hand-clearance", BASE_SPEC, gmtCatalog({}))).toEqual([]);
    });
  });
});

describe("dial-text", () => {
  const withText = (dialText: string, changes: Partial<WatchSpec> = {}) => specWith(changes, { dialText });

  it("accepts short, original text on a printable dial", () => {
    expect(issuesOf("dial-text", withText("Anna & Leo, 2024"))).toEqual([]);
    expect(issuesOf("dial-text", withText("   ", { dialId: "dial-diver-blue" }))).toEqual([]);
  });

  it("is an error on a dial that can't be printed", () => {
    const [issue] = issuesOf("dial-text", withText("Anna", { dialId: "dial-diver-blue" }));
    expect(issue).toMatchObject({ severity: "error", slots: ["dialId"] });
  });

  it.each([
    ["20 characters is within the limit", "x".repeat(20), false],
    ["21 characters", "x".repeat(21), true],
    ["a disallowed character", "Hello!", true],
    ["a brand", "R O L E X", true],
    ["a Swiss indication", "Swiss Made", true],
  ])("%s", (_case, text, isError) => {
    const errors = severitiesOf("dial-text", withText(text)).filter((severity) => severity === "error");
    expect(errors).toEqual(isError ? ["error"] : []);
  });

  describe("too long to print legibly", () => {
    const capacity = (spec: WatchSpec) => {
      const { dial, case: watchCase } = resolveSpec(spec, fixtureCatalog());
      return fitDialText(dial!, watchCase!.chapterRing, "x").maxLegibleCharacters;
    };

    it("warns once the line only fits below the smallest legible size, saying how much fits", () => {
      const room = capacity(BASE_SPEC);
      expect(room).toBeGreaterThan(10);
      expect(room).toBeLessThan(20);
      expect(issuesOf("dial-text", withText("x".repeat(room)))).toEqual([]);

      const [issue] = issuesOf("dial-text", withText("x".repeat(room + 1)));
      expect(issue).toMatchObject({ ruleId: "dial-text", severity: "warning", slots: ["dialId"] });
      expect(issue.message).toContain(`about ${room} characters fit`);
      expect(issue.fixes.map((fix) => fix.description)).toContain("Remove the dial text");
    });

    it("measures between the markers the preview draws: arabic numerals leave less room than printed batons", () => {
      expect(capacity(FIELD_SPEC)).toBeLessThan(capacity(BASE_SPEC));
      const text = "x".repeat(capacity(FIELD_SPEC) + 1);
      expect(severitiesOf("dial-text", specWith({}, { dialText: text }))).toEqual([]);
      expect(severitiesOf("dial-text", { ...FIELD_SPEC, personalization: { dialText: text, casebackEngraving: "" } })).toEqual([
        "warning",
      ]);
    });

    it("leaves over-long text and unprintable dials to their errors", () => {
      expect(severitiesOf("dial-text", withText("x".repeat(21)))).toEqual(["error"]);
      expect(severitiesOf("dial-text", withText("x".repeat(20), { dialId: "dial-diver-blue" }))).toEqual(["error"]);
    });
  });

  it("accepts a typographic apostrophe once the text is normalised, and refuses fullwidth brand names", () => {
    expect(severitiesOf("dial-text", withText("Grandpa’s watch"))).toEqual(["error"]);
    expect(issuesOf("dial-text", withText(normalizePersonalizationText("Grandpa’s watch")))).toEqual([]);
    const fullwidth = issuesOf("caseback-engraving", specWith({}, { casebackEngraving: "ＲＯＬＥＸ Ｓｗｉｓｓ Ｍａｄｅ" }));
    expect(fullwidth.map((issue) => issue.message)).toEqual([
      expect.stringContaining("but not"),
      expect.stringContaining("'Rolex' is another watch company's trademark"),
      expect.stringContaining("'Swiss' is a protected indication"),
    ]);
  });

  it("explains each problem with the wording, without blaming a part", () => {
    const issues = issuesOf("dial-text", withText("ROLEX SWISS MADE!!! 1953"));
    expect(issues.map((issue) => issue.message)).toEqual([
      "Dial text can be at most 20 characters long; yours has 24.",
      "Dial text can use letters, numbers, spaces and the marks . , ' & - but not '!'.",
      expect.stringContaining("'Rolex' is another watch company's trademark"),
      expect.stringContaining("'Swiss' is a protected indication"),
    ]);
    expect(issues.every((issue) => issue.slots.length === 0)).toBe(true);
  });
});

describe("caseback-engraving", () => {
  const withEngraving = (casebackEngraving: string, changes: Partial<WatchSpec> = {}) =>
    specWith(changes, { casebackEngraving });

  it("is an error on a display caseback", () => {
    const [issue] = issuesOf("caseback-engraving", withEngraving("For Anna", { caseId: "case-diver-display" }));
    expect(issue).toMatchObject({ severity: "error", slots: ["caseId"] });
    expect(issue.message).toContain("glass can't be laser-engraved");
  });

  it.each([
    ["60 characters is fine", "x".repeat(60), false],
    ["61 characters", "x".repeat(61), true],
    ["a disallowed character", "Love @ 2024", true],
    ["a brand", "Not an Omega", true],
    ["a Swiss indication", "Genève 1953", true],
    ["an ordinary dedication", "To Grace, for 25 years - love, Tom", false],
  ])("%s", (_case, text, isError) => {
    expect(severitiesOf("caseback-engraving", withEngraving(text))).toEqual(isError ? ["error"] : []);
  });
});

describe("lume-match", () => {
  it("notes lume in two different colours", () => {
    const [issue] = issuesOf("lume-match", specWith({ handsId: "hands-mercedes-blue-lume" }));
    expect(issue).toMatchObject({ severity: "info", slots: ["dialId", "handsId"], fixes: [] });
  });

  it("stays quiet when either part has no lume", () => {
    expect(issuesOf("lume-match", specWith({ dialId: "dial-dress-silver", handsId: "hands-mercedes-blue-lume" }))).toEqual([]);
  });
});

describe("crystal-material", () => {
  it.each([
    [200, "crystal-mineral-315", ["info"]],
    [199, "crystal-mineral-315", []],
    [300, "crystal-sapphire-315", []],
  ])("a %i m case with %s: %j", (rating, crystalId, expected) => {
    const catalog = fixtureCatalog();
    byId(catalog.cases, "case-diver").waterResistanceM = rating;
    expect(severitiesOf("crystal-material", specWith({ crystalId }), catalog)).toEqual(expected);
  });
});

describe("style-coherence", () => {
  it("notes a dial style that differs from the case", () => {
    const [issue] = issuesOf("style-coherence", specWith({ dialId: "dial-gmt-black" }));
    expect(issue).toMatchObject({ severity: "info", slots: ["dialId", "caseId"] });
    expect(issue.message).toMatch(/^A GMT dial in a dive-style case/);
  });

  it("stays quiet when the styles match", () => {
    expect(issuesOf("style-coherence", BASE_SPEC)).toEqual([]);
  });
});

describe("the report", () => {
  const messy = specWith({
    movementId: "mv-daydate",
    handsId: "hands-mercedes-blue-lume",
    crystalId: "crystal-mineral-315",
    strapId: "strap-nato-olive-20",
  });

  it("lists errors, then warnings, then info", () => {
    const { buildable, issues } = validateSpec(messy, fixtureCatalog());
    expect(buildable).toBe(false);
    expect(issues.map((issue) => `${issue.severity} ${issue.ruleId}`)).toEqual([
      "error strap-width",
      "warning date-window",
      "info lume-match",
      "info crystal-material",
    ]);
  });

  it("is buildable with only warnings and info", () => {
    const report = validateSpec({ ...messy, strapId: "strap-rubber-black-22" }, fixtureCatalog());
    expect(report.buildable).toBe(true);
    expect(report.issues.length).toBe(3);
  });

  it("is deterministic", () => {
    expect(validateSpec(messy, fixtureCatalog())).toEqual(validateSpec(messy, fixtureCatalog()));
  });
});
