import { describe, expect, it } from "vitest";
import { CATALOG, findPart } from "@/domain/catalog";
import type { Part } from "@/domain/types";
import { partHighlights, partSwatch, waterResistanceLabel } from "./partInfo";

const everyPart: Part[] = Object.values(CATALOG).flat();

describe("partHighlights", () => {
  it("summarises every catalogue part with a few non-empty facts", () => {
    for (const part of everyPart) {
      const highlights = partHighlights(part);
      expect(highlights.length, part.id).toBeGreaterThanOrEqual(2);
      expect(highlights.every((fact) => fact.trim().length > 0), part.id).toBe(true);
    }
  });

  it("leads a case with the numbers customers compare", () => {
    const watchCase = findPart("case-diver-42");
    expect(watchCase && partHighlights(watchCase)).toEqual([
      "42 mm",
      "46 mm lug to lug",
      "13.3 mm thick",
      "22 mm lugs",
      "200 m",
    ]);
  });

  it("marks a water resistance the case maker hasn't confirmed", () => {
    const estimated = CATALOG.cases.filter((watchCase) => watchCase.waterResistanceEstimated);
    expect(estimated.map((watchCase) => watchCase.id).sort()).toEqual(["case-diver-39", "case-dress-39", "case-pilot-39"]);
    for (const watchCase of estimated) {
      expect(partHighlights(watchCase)).toContain(`${watchCase.waterResistanceM} m (to be confirmed)`);
    }
    expect(waterResistanceLabel({ waterResistanceM: 200 })).toBe("200 m");
  });

  it("tells a dial's crown position in plain clock terms, without other brands' model names", () => {
    const dialHighlights = CATALOG.dials.flatMap((dial) => partHighlights(dial));
    expect(dialHighlights).toContain("crown at about 4 o'clock");
    expect(dialHighlights).toContain("crown at 3 o'clock");
    expect(dialHighlights.join(" ")).not.toMatch(/SKX|3\.8/);
  });

  it("names the movement's caliber and complications", () => {
    const movement = findPart("mv-nh34a");
    expect(movement && partHighlights(movement).slice(0, 2)).toEqual(["NH34A", expect.stringContaining("GMT")]);
  });
});

describe("partSwatch", () => {
  it("gives colour choices a swatch and leaves movements and crystals without one", () => {
    for (const part of everyPart) {
      const swatch = partSwatch(part);
      if (part.category === "movement" || part.category === "crystal") expect(swatch, part.id).toBeNull();
      else expect(swatch?.base, part.id).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });
});
