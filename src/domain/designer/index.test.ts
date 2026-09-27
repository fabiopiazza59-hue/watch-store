import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC, TEMPLATES } from "../catalog";
import type { WatchSpec } from "../types";
import { describeSpecChanges } from "./diff";
import { designerStatus, designWatch } from ".";

const FIELD = TEMPLATES.find((t) => t.id === "tpl-everyday-field")?.spec as WatchSpec;

describe("describeSpecChanges", () => {
  it("lists changed parts by name, in configurator order, then text", () => {
    const after: WatchSpec = {
      ...FIELD,
      dialId: "dial-field-cream",
      strapId: "strap-leather-tan-20",
      personalization: { dialText: "For Anna", casebackEngraving: "" },
    };
    expect(describeSpecChanges(FIELD, after)).toEqual([
      "Dial: Field Olive → Field Cream",
      "Strap: Khaki canvas 20mm → Tan leather 20mm",
      "Dial text: none → 'For Anna'",
    ]);
  });

  it("names removed inserts, renamed designs and unknown ids", () => {
    expect(describeSpecChanges(DEFAULT_SPEC, { ...DEFAULT_SPEC, name: "Sea", bezelInsertId: null, dialId: "dial-x" })).toEqual([
      "Name: 'My first watch' → 'Sea'",
      "Dial: Diver Black → unknown part 'dial-x'",
      "Bezel insert: Dive 60 Black (aluminium) → none",
    ]);
  });

  it("is empty when nothing changed", () => {
    expect(describeSpecChanges(FIELD, { ...FIELD })).toEqual([]);
  });
});

describe("designWatch without an API key", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("answers offline with the rules report, a quote and the changes", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const response = await designWatch({ message: "put 'For Anna' on the dial", currentSpec: FIELD });
    expect(response.mode).toBe("offline");
    expect(response.spec).toEqual({ ...FIELD, personalization: { dialText: "For Anna", casebackEngraving: "" } });
    expect(response.report.buildable).toBe(true);
    expect(response.quote.suggestedRetailEur).toBeGreaterThan(0);
    expect(response.changes).toEqual(["Dial text: none → 'For Anna'"]);
  });

  it("diffs against the default design when the configurator sent none", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const response = await designWatch({ message: "a 38mm green field watch" });
    expect(response.changes).toContain("Case: Classic Diver 42 → Field 38");
  });
});

describe("designerStatus", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports Claude and its model only when an API key is configured", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(designerStatus()).toEqual({ mode: "offline", model: null });
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("ANTHROPIC_MODEL", "");
    expect(designerStatus()).toEqual({ mode: "claude", model: "claude-opus-5" });
  });
});
