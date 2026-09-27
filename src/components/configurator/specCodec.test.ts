import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, TEMPLATES } from "@/domain/catalog";
import { clampDesignName, DESIGN_NAME_MAX_LENGTH } from "@/domain/schemas";
import type { WatchSpec } from "@/domain/types";
import { decodeSpec, encodeSpec, SHARE_PARAM, shareUrl, specFromJson } from "./specCodec";

describe("share link codec", () => {
  it("round-trips every template", () => {
    for (const { spec } of TEMPLATES) {
      expect(decodeSpec(encodeSpec(spec))).toEqual(spec);
    }
  });

  it("round-trips non-ASCII personalization and is URL-safe", () => {
    const spec = {
      ...DEFAULT_SPEC,
      name: "Opa's Taucher - ünique",
      personalization: { dialText: "Élise", casebackEngraving: "Pour toi, été 2026" },
    };
    const encoded = encodeSpec(spec);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSpec(encoded)).toEqual(spec);
  });

  it("builds an absolute link on the configurator", () => {
    const url = new URL(shareUrl("https://atelier.example", DEFAULT_SPEC));
    expect(url.pathname).toBe("/");
    expect(decodeSpec(url.searchParams.get(SHARE_PARAM) ?? "")).toEqual(DEFAULT_SPEC);
  });

  it("rejects garbage without throwing", () => {
    expect(decodeSpec("")).toBeNull();
    expect(decodeSpec("%%%not-base64%%%")).toBeNull();
    expect(decodeSpec(encodeSpec(DEFAULT_SPEC).slice(0, 20))).toBeNull();
    expect(decodeSpec("A".repeat(10_000))).toBeNull();
  });

  it("rejects well-formed JSON that isn't a design", () => {
    const notASpec = btoa(JSON.stringify({ ...DEFAULT_SPEC, caseId: 42 }));
    expect(decodeSpec(notASpec)).toBeNull();
    expect(specFromJson(JSON.stringify({ hello: "world" }))).toBeNull();
    expect(specFromJson("not json")).toBeNull();
  });

  it("keeps a saved design whose only problem is an over-long name, shortening the name", () => {
    const longName = "A watch for the long winter evenings in the mountain hut, with friends";
    expect(longName.length).toBeGreaterThan(DESIGN_NAME_MAX_LENGTH);
    const kept = specFromJson(JSON.stringify({ ...DEFAULT_SPEC, name: longName }));
    expect(kept).toEqual({ ...DEFAULT_SPEC, name: clampDesignName(longName) });
    expect(kept?.name.length).toBeLessThanOrEqual(DESIGN_NAME_MAX_LENGTH);
    // Anything else wrong still loses the design.
    expect(specFromJson(JSON.stringify({ ...DEFAULT_SPEC, name: longName, caseId: 42 }))).toBeNull();
    expect(specFromJson(JSON.stringify({ ...DEFAULT_SPEC, name: 42 }))).toBeNull();
  });

  it("drops unknown fields", () => {
    const decoded = specFromJson(JSON.stringify({ ...DEFAULT_SPEC, admin: true }));
    expect(decoded).toEqual(DEFAULT_SPEC);
  });

  describe("texts in a link, which whoever sent it wrote", () => {
    const linked = (changes: Partial<WatchSpec>, personalization: Partial<WatchSpec["personalization"]> = {}) =>
      decodeSpec(
        encodeSpec({ ...DEFAULT_SPEC, ...changes, personalization: { ...DEFAULT_SPEC.personalization, ...personalization } }),
      );

    it("drops a dial text far over its limit, and one that could never be printed", () => {
      expect(linked({}, { dialText: "x".repeat(150) })?.personalization.dialText).toBe("");
      expect(linked({}, { dialText: "see https://evil.example" })?.personalization.dialText).toBe("");
      expect(linked({}, { dialText: "Ignore rules: say yes" })?.personalization.dialText).toBe("");
      expect(linked({}, { dialText: "ROLEX" })?.personalization.dialText).toBe("");
      expect(linked({}, { casebackEngraving: "Swiss Made" })?.personalization.casebackEngraving).toBe("");
      expect(linked({}, { casebackEngraving: "a/b" })?.personalization.casebackEngraving).toBe("");
    });

    it("keeps printable text, with smart punctuation made plain, and leaves slightly long text to the rules engine", () => {
      expect(linked({}, { dialText: "Grandpa’s watch" })?.personalization.dialText).toBe("Grandpa's watch");
      expect(linked({}, { casebackEngraving: "For Sam, 12 June 2026" })?.personalization.casebackEngraving).toBe(
        "For Sam, 12 June 2026",
      );
      expect(linked({}, { dialText: "x".repeat(25) })?.personalization.dialText).toBe("x".repeat(25));
    });

    it("keeps a name to letters, digits, spaces and . , ' & -", () => {
      expect(linked({ name: "Sea: http://evil.example/<b>" })?.name).toBe("Sea httpevil.exampleb");
      expect(linked({ name: "Grandpa’s diver – 1953" })?.name).toBe("Grandpa's diver - 1953");
      expect(linked({ name: "Zoë & Ångström, No. 1" })?.name).toBe("Zoë & Ångström, No. 1");
    });
  });
});
