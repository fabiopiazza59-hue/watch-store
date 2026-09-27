import { describe, expect, it } from "vitest";
import { parseIntent } from "./intent";

describe("parseIntent", () => {
  it("reads style, size, colour and strap from a typical request", () => {
    const intent = parseIntent("a 38mm green field watch on a leather strap");
    expect(intent).toMatchObject({
      style: "field",
      size: { kind: "target", mm: 38 },
      strapType: "leather",
      colors: { dial: ["green"], strap: [] },
    });
  });

  it("ties colours to the part they describe", () => {
    expect(parseIntent("travel GMT watch with a blue and red bezel").colors.bezel).toEqual(["blue", "red"]);
    expect(parseIntent("a white dial with blue hands and a brown leather strap").colors).toMatchObject({
      dial: ["white"],
      hands: ["blue"],
      strap: ["brown"],
    });
    expect(parseIntent("a watch with the strap in navy").colors.strap).toEqual(["blue"]);
  });

  it("takes the case colour for the dial when no dial colour is given, without assuming a coated case", () => {
    const intent = parseIntent("black titanium sport watch on rubber");
    expect(intent).toMatchObject({ style: "sport", material: "titanium", strapType: "rubber", blackCase: false });
    expect(intent.colors.dial).toEqual(["black"]);
    expect(parseIntent("a diver with a black case").blackCase).toBe(true);
  });

  it("sends quoted text to the caseback or the dial depending on the nearest cue", () => {
    expect(parseIntent("elegant dress watch for my wedding, engrave 'A & M 2026' on the back")).toMatchObject({
      casebackEngraving: "A & M 2026",
      dialText: undefined,
    });
    expect(parseIntent("dial saying “For Anna” and engrave 'Love, M' on the back")).toMatchObject({
      dialText: "For Anna",
      casebackEngraving: "Love, M",
    });
    expect(parseIntent("'Grandpa Joe' on the case back")).toMatchObject({ casebackEngraving: "Grandpa Joe" });
    expect(parseIntent("call it 'Sea Breeze'")).toMatchObject({ designName: "Sea Breeze", dialText: undefined });
  });

  it("does not mistake apostrophes for quotes", () => {
    expect(parseIntent("I'm after my grandpa's style of field watch, it's lovely")).toMatchObject({
      dialText: undefined,
      casebackEngraving: undefined,
      style: "field",
    });
  });

  it("finds budgets but not sizes, depths or years", () => {
    expect(parseIntent("something under 300").budgetEur).toBe(300);
    expect(parseIntent("a diver, €400 max").budgetEur).toBe(400);
    expect(parseIntent("around 350 euros").budgetEur).toBe(350);
    expect(parseIntent("under 40mm please, and 200m of water resistance").budgetEur).toBeUndefined();
    expect(parseIntent("engrave 'June 2026' on the back").budgetEur).toBeUndefined();
  });

  it("reads date preferences", () => {
    expect(parseIntent("no date please").date).toBe("none");
    expect(parseIntent("with a day-date").date).toBe("day-date-3");
    expect(parseIntent("I need a date window").date).toBe("date-3");
  });

  it("notices other brands and Swiss indications, but not the idiom 'price tag'", () => {
    expect(parseIntent("a Rolex Submariner with the logo").brands).toEqual(["Rolex", "Submariner"]);
    expect(parseIntent("a diver with a friendly price tag").brands).toEqual([]);
    expect(parseIntent("can it say Swiss Made?").swiss).toBe(true);
  });

  it("flags requests the parts library cannot meet", () => {
    expect(parseIntent("a quartz chronograph with diamonds").unsupported).toEqual(["quartz", "chronograph", "gemstones"]);
    expect(parseIntent("a 36mm vintage gold watch").unsupported).toEqual(["gold-case"]);
    expect(parseIntent("a diver with gold details").unsupported).toEqual([]);
  });
});
