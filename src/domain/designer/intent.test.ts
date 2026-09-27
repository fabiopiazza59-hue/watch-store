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

  it("reads removals and refusals as the opposite of a wish", () => {
    expect(parseIntent("remove the date").date).toBe("none");
    expect(parseIntent("please drop the date window").date).toBe("none");
    expect(parseIntent("not black, a blue dial please").colors.dial).toEqual(["blue"]);
    expect(parseIntent("I don't want a diver")).toMatchObject({ style: undefined, rejectedStyles: ["diver"] });
    expect(parseIntent("a blue diver instead of the black one").colors.dial).toEqual(["blue"]);
    expect(parseIntent("delete the dial text")).toMatchObject({ clearDialText: true });
    expect(parseIntent("remove the engraving")).toMatchObject({ clearEngraving: true, unquotedText: undefined });
  });

  it("keeps a bare 'no' as a wish", () => {
    expect(parseIntent("a no-date diver")).toMatchObject({ style: "diver", date: "none" });
    expect(parseIntent("no, keep the case but make the strap black leather")).toMatchObject({
      strapType: "leather",
      colors: { strap: ["black"], dial: [] },
    });
  });

  it("ties a colour to the part named before it", () => {
    expect(parseIntent("make the strap brown").colors).toMatchObject({ strap: ["brown"], dial: [] });
    expect(parseIntent("make the bezel blue").colors).toMatchObject({ bezel: ["blue"], dial: [] });
    expect(parseIntent("Make the dial green and the strap brown").colors).toMatchObject({ dial: ["green"], strap: ["brown"] });
    expect(parseIntent("swap the strap for a blue one").colors).toMatchObject({ strap: ["blue"], dial: [] });
    const hands = parseIntent("change the hands to gold");
    expect(hands.colors).toMatchObject({ hands: ["gold"], dial: [] });
    expect(hands.unsupported).not.toContain("gold-case");
    expect(parseIntent("a no-date diver with a blue ceramic bezel").colors).toMatchObject({ bezel: ["blue"], dial: [] });
  });

  it("reads rose gold as gold, keeps lume colours off the dial and remembers the customer's words", () => {
    const rose = parseIntent("rose gold with a white dial");
    expect(Object.values(rose.colors).flat()).not.toContain("salmon");
    expect(rose.colors.dial).toEqual(["white", "gold"]);
    expect(rose.unsupported).toContain("gold-case");
    expect(parseIntent("a watch with lume that glows blue")).toMatchObject({ lume: true, colors: { dial: [] } });
    expect(parseIntent("a black dial with blue lume").colors.dial).toEqual(["black"]);
    expect(parseIntent("a pink dial").colorWords).toEqual({ salmon: "pink" });
    expect(parseIntent("white numerals on a black dial")).toMatchObject({ dialPrint: ["white"] });
  });

  it("notices when nothing was understood", () => {
    for (const message of ["hello", "what's the power reserve?", "something nice for my dad"]) {
      expect(parseIntent(message).recognised).toBe(false);
    }
    expect(parseIntent("a diver").recognised).toBe(true);
  });

  it("reads cheaper, depth ratings and calibres", () => {
    expect(parseIntent("make it cheaper").lean).toBe(true);
    expect(parseIntent("something affordable").lean).toBe(true);
    expect(parseIntent("a 300m diver").waterResistanceM).toBe(300);
    expect(parseIntent("20 bar please").waterResistanceM).toBe(200);
    expect(parseIntent("a 40mm diver").waterResistanceM).toBeUndefined();
    expect(parseIntent("swap the NH35 for an NH38")).toMatchObject({ caliber: "NH38A", date: "none" });
    expect(parseIntent("an NH36 instead of the NH35")).toMatchObject({ caliber: "NH36A", date: "day-date-3" });
    expect(parseIntent("an NH34 please")).toMatchObject({ caliber: "NH34A", gmt: true });
  });

  it("takes labelled text without quotes, and asks for quotes otherwise", () => {
    expect(parseIntent("engraving: For Sam")).toMatchObject({ casebackEngraving: "For Sam", unquotedText: undefined });
    expect(parseIntent("dial text: Est. 2026")).toMatchObject({ dialText: "Est. 2026" });
    expect(parseIntent("engraving: my blue diver")).toMatchObject({ casebackEngraving: "my blue diver", colors: { dial: [] } });
    expect(parseIntent("add engraving For Sam")).toMatchObject({ casebackEngraving: undefined, unquotedText: "caseback" });
    expect(parseIntent("I'd like an engraving on the back").unquotedText).toBe("caseback");
  });

  it("makes smart apostrophes and dashes in quoted text plain, as the order store keeps them", () => {
    expect(parseIntent("engraving: Grandpa’s watch")).toMatchObject({ casebackEngraving: "Grandpa's watch" });
    expect(parseIntent('print "1953 – 2026" on the dial')).toMatchObject({ dialText: "1953 - 2026" });
  });

  it("won't take another company's name as a design name, and shortens long ones", () => {
    const rolex = parseIntent("call it 'Rolex Homage'");
    expect(rolex.designName).toBeUndefined();
    expect(rolex.rejectedName).toEqual({ text: "Rolex Homage", marks: ["Rolex"] });
    const long = parseIntent('call it "The watch I will wear at my wedding in the mountains next summer ok"');
    expect(long.nameShortened).toBe(true);
    expect(long.designName?.length).toBeLessThanOrEqual(60);
  });

  it("understands a few words in other languages", () => {
    expect(parseIntent("Une montre de plongée bleue avec bracelet en cuir")).toMatchObject({
      style: "diver",
      strapType: "leather",
      colors: { dial: ["blue"] },
      foreign: true,
    });
    expect(parseIntent("Un reloj de buzo azul con correa de caucho")).toMatchObject({ style: "diver", strapType: "rubber" });
    expect(parseIntent("Eine Fliegeruhr mit schwarzem Zifferblatt").style).toBe("pilot");
    expect(parseIntent("a steel bracelet").strapType).toBe("bracelet");
  });
});
