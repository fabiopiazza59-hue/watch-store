import { describe, expect, it } from "vitest";
import { resolveSpec, TEMPLATES } from "../catalog";
import { validateSpec } from "../rules";
import type { DesignRequest, ResolvedSpec, WatchSpec } from "../types";
import { colorMatch, lightness } from "./colors";
import { designOffline } from "./offline";

function templateSpec(id: string): WatchSpec {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`No template ${id}`);
  return template.spec;
}

function design(message: string, currentSpec?: WatchSpec) {
  const req: DesignRequest = { message, currentSpec };
  const draft = designOffline(req, "no-key");
  const parts: ResolvedSpec = resolveSpec(draft.spec);
  return { ...draft, parts, report: validateSpec(draft.spec) };
}

const PROMPTS = [
  "a 38mm green field watch on a leather strap",
  "elegant dress watch for my wedding, engrave 'A & M 2026' on the back",
  "travel GMT watch with a blue and red bezel",
  "black titanium sport watch on rubber",
  "a Rolex Submariner with the logo",
  "a small vintage diver with gold details and no date, around 350 euros",
  "I'd like a quartz chronograph",
  "print 'Swiss Made' on the dial",
  "pilot watch with a salmon dial",
];

describe("designOffline", () => {
  it.each(PROMPTS)("designs something buildable, deterministically: %s", (message) => {
    const first = design(message);
    expect(first.mode).toBe("offline");
    expect(first.report.buildable).toBe(true);
    expect(designOffline({ message }, "no-key")).toEqual({ mode: first.mode, spec: first.spec, reply: first.reply });
  });

  it("builds a 38mm green field watch on leather", () => {
    const { parts } = design("a 38mm green field watch on a leather strap");
    expect(parts.case).toMatchObject({ style: "field", diameterMm: 38 });
    expect(parts.dial?.style).toBe("field");
    expect(colorMatch(parts.dial?.colorHex ?? "", "green")).toBeGreaterThan(0.6);
    expect(parts.strap?.type).toBe("leather");
  });

  it("engraves the wedding watch, moving to a solid caseback and explaining why", () => {
    const { parts, spec, reply } = design("elegant dress watch for my wedding, engrave 'A & M 2026' on the back");
    expect(spec.personalization.casebackEngraving).toBe("A & M 2026");
    expect(parts.case?.caseback).toBe("solid");
    expect(parts.dial?.style).toBe("dress");
    expect(parts.hands?.style).toBe("dauphine");
    expect(parts.strap?.type).toBe("leather");
    expect(reply).toContain("display caseback");
    expect(reply).toContain("'A & M 2026' will be laser-engraved");
  });

  it("builds a GMT with a blue and red 24-hour bezel", () => {
    const { parts } = design("travel GMT watch with a blue and red bezel");
    expect(parts.movement?.complications).toContain("gmt");
    expect(parts.hands?.includesGmt).toBe(true);
    expect(parts.bezelInsert?.scale).toBe("gmt-24");
    const colours = [parts.bezelInsert?.colorHex ?? "", parts.bezelInsert?.secondaryColorHex ?? ""];
    expect(Math.max(...colours.map((hex) => colorMatch(hex, "blue")))).toBeGreaterThan(0.6);
    expect(Math.max(...colours.map((hex) => colorMatch(hex, "red")))).toBeGreaterThan(0.6);
  });

  it("puts the titanium case first for a black titanium sport watch on rubber", () => {
    const { parts } = design("black titanium sport watch on rubber");
    expect(parts.case?.material).toBe("titanium");
    expect(parts.strap?.type).toBe("rubber");
    expect(lightness(parts.dial?.colorHex ?? "#ffffff")).toBeLessThan(0.2);
  });

  it("refuses another brand's name and logo but designs in the same spirit", () => {
    const { parts, spec, reply } = design("a Rolex Submariner with the logo");
    expect(parts.case?.style).toBe("diver");
    expect(spec.personalization.dialText).toBe("");
    expect(reply).toMatch(/Rolex and Submariner are other companies' trademarks/);
  });

  it("finds the small gilt, no-date diver and is honest about an impossible budget", () => {
    const { parts, reply } = design("a small vintage diver with gold details and no date, around 350 euros");
    expect(parts.case).toMatchObject({ style: "diver", diameterMm: 39 });
    expect(parts.movement?.dateDisplay).toBe("none");
    expect(parts.dial?.dateWindow).toBe("none");
    expect(colorMatch(parts.dial?.printColorHex ?? "", "gold")).toBeGreaterThan(0.8);
    expect(colorMatch(parts.hands?.colorHex ?? "", "gold")).toBeGreaterThan(0.8);
    expect(reply).toMatch(/over your €350 budget/);
  });

  it("says plainly when a request is impossible with these parts", () => {
    expect(design("I'd like a quartz chronograph").reply).toMatch(/automatic NH3x movement rather than quartz/);
    expect(design("pilot watch with a salmon dial").reply).toMatch(/no salmon dial in the parts library/);
  });

  it("keeps protected words off the dial and quotes the rule", () => {
    const { spec, reply } = design("print 'Swiss Made' on the dial");
    expect(spec.personalization.dialText).toBe("");
    expect(reply).toMatch(/I couldn't use 'Swiss Made'/);
  });

  it("changes only what an edit asks for", () => {
    const field = templateSpec("tpl-everyday-field");
    const strap = design("make the strap brown leather", field);
    expect({ ...strap.spec, strapId: field.strapId }).toEqual(field);
    expect(strap.parts.strap?.type).toBe("leather");
    expect(colorMatch(strap.parts.strap?.colorHex ?? "", "brown")).toBeGreaterThan(0.6);

    const text = design("put 'For Anna' on the dial", field);
    expect(text.spec).toEqual({ ...field, personalization: { ...field.personalization, dialText: "For Anna" } });
    expect(text.reply).toContain("'For Anna' will be printed on the dial");
  });

  it("names a new proposal after what it is, but never renames a design the customer named", () => {
    expect(design("a 38mm green field watch on a leather strap").spec.name).toBe("38mm green field watch");
    const fromTemplate = design("a 38mm green field watch on a leather strap", templateSpec("tpl-classic-diver"));
    expect(fromTemplate.spec.name).toBe("38mm green field watch");
    const named = { ...templateSpec("tpl-classic-diver"), name: "Dad's watch" };
    expect(design("a 38mm green field watch on a leather strap", named).spec.name).toBe("Dad's watch");
    expect(design("call it 'Weekend' and make it a field watch").spec.name).toBe("Weekend");
    // A small edit keeps the template's name: it is still that design.
    expect(design("make the strap brown leather", templateSpec("tpl-everyday-field")).spec.name).toBe("Everyday Field");
  });

  it("doesn't claim a request already fits when the customer's own dial text is what blocks it", () => {
    const olive = design("a 38mm green field watch on a leather strap").spec;
    const current = { ...olive, personalization: { ...olive.personalization, dialText: "Est. 2026" } };
    const { spec, reply } = design("make it blue instead", current);
    expect(spec.personalization.dialText).toBe("Est. 2026");
    expect(reply).not.toMatch(/already fits/);
    expect(reply).toMatch(/can't take custom printing/);
    expect(reply).toMatch(/I've kept the Field Olive dial\. Remove the dial text if you'd rather have that dial\./);
  });

  it("mentions the API key only when that is why it is answering, as the last sentence", () => {
    expect(designOffline({ message: "a diver" }, "no-key").reply).toMatch(/Anthropic API key[^.]*\.$/);
    expect(designOffline({ message: "a diver" }, "unavailable").reply).not.toMatch(/API key/);
    expect(designOffline({ message: "a diver" }, "refusal").reply).not.toMatch(/API key/);
  });
});
