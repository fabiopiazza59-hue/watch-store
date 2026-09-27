import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC, TEMPLATES } from "../catalog";
import { watchSpecSchema } from "../schemas";
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

  it("never returns a design the API schemas would refuse on the next request", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const message = 'a green field watch, call it "The watch I will wear at my wedding in the mountains next summer ok"';
    const response = await designWatch({ message, currentSpec: DEFAULT_SPEC });
    expect(response.spec.name.length).toBeLessThanOrEqual(60);
    expect(watchSpecSchema.safeParse(response.spec).success).toBe(true);
    expect(response.report.buildable).toBe(true);
  });

  it("returns the texts with plain apostrophes, even ones already in the design", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const currentSpec = { ...FIELD, personalization: { dialText: "", casebackEngraving: "For Dad – 1953" } };
    const response = await designWatch({ message: 'put "Grandpa’s watch" on the dial', currentSpec });
    expect(response.spec.personalization).toEqual({ dialText: "Grandpa's watch", casebackEngraving: "For Dad - 1953" });
    expect(response.report.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("tells the server log, not the customer, that no API key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { reply } = await designWatch({ message: "a field watch" });
    await designWatch({ message: "a dress watch" });
    expect(reply).not.toMatch(/API key|ANTHROPIC/);
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
    warn.mockRestore();
  });

  it("diffs against the default design when the configurator sent none", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const response = await designWatch({ message: "a 38mm green field watch" });
    expect(response.changes).toContain("Case: Classic Diver 42 → Field 38");
  });
});

describe("designWatch with an API key", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("answers offline without calling Claude when told to, e.g. past a daily cap", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const response = await designWatch({ message: "a field watch", currentSpec: FIELD }, { claude: false });
    expect(response.mode).toBe("offline");
    expect(response.reply).toMatch(/unavailable right now/);
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
