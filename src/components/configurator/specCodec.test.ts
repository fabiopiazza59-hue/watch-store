import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, TEMPLATES } from "@/domain/catalog";
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
      name: "Opa's Taucher – ünique",
      personalization: { dialText: "Élise", casebackEngraving: "Pour toi, été 2026 ✓" },
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

  it("drops unknown fields", () => {
    const decoded = specFromJson(JSON.stringify({ ...DEFAULT_SPEC, admin: true }));
    expect(decoded).toEqual(DEFAULT_SPEC);
  });
});
