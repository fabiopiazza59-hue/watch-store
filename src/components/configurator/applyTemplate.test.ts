import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, type DesignTemplate, NO_EXTRAS, TEMPLATES } from "@/domain/catalog";
import { validateSpec } from "@/domain/rules";
import type { WatchSpec } from "@/domain/types";
import { applyTemplate, templateLabel } from "./applyTemplate";

function template(id: string): DesignTemplate {
  const found = TEMPLATES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No template ${id}`);
  return found;
}

const PERSONAL: WatchSpec = {
  ...DEFAULT_SPEC,
  name: "Grandpa's watch",
  personalization: { dialText: "Est. 1952", casebackEngraving: "For Sam" },
};

describe("applyTemplate", () => {
  it("takes the template's parts and keeps the customer's name and texts", () => {
    const pilot = template("tpl-slate-pilot");
    const next = applyTemplate(PERSONAL, pilot);
    expect(next).toEqual({ ...pilot.spec, name: "Grandpa's watch", personalization: PERSONAL.personalization });
    expect(templateLabel(PERSONAL, pilot)).toBe("Started from Slate Pilot, keeping your name, dial text and engraving.");
  });

  it("names the design after the template when it still had the default or another template's name", () => {
    const pilot = template("tpl-slate-pilot");
    expect(applyTemplate(DEFAULT_SPEC, pilot).name).toBe("Slate Pilot");
    const fromDiver = applyTemplate(DEFAULT_SPEC, template("tpl-classic-diver"));
    expect(applyTemplate(fromDiver, pilot).name).toBe("Slate Pilot");
    expect(applyTemplate({ ...DEFAULT_SPEC, name: "  " }, pilot).name).toBe("Slate Pilot");
    expect(templateLabel(DEFAULT_SPEC, pilot)).toBe("Started from Slate Pilot.");
  });

  describe("extras", () => {
    const WITH_EXTRAS: WatchSpec = {
      ...DEFAULT_SPEC,
      extras: { spareStrapId: "strap-leather-brown-22", itemIds: ["extra-presentation-box", "extra-gift-wrap"] },
    };

    it("keeps the customer's spare strap and add-ons, and says so", () => {
      const field = template("tpl-everyday-field");
      const next = applyTemplate(WITH_EXTRAS, field);
      expect(next.extras).toEqual(WITH_EXTRAS.extras);
      expect(next.caseId).toBe(field.spec.caseId);
      expect(templateLabel(WITH_EXTRAS, field)).toBe(`Started from ${field.name}, keeping your extras.`);
      expect(templateLabel({ ...PERSONAL, extras: WITH_EXTRAS.extras }, field)).toBe(
        `Started from ${field.name}, keeping your name, dial text, engraving and extras.`,
      );
    });

    it("adds none when the customer has none, even from a template that carries some", () => {
      const pilot = template("tpl-slate-pilot");
      const withGift = { ...pilot, spec: { ...pilot.spec, extras: { spareStrapId: null, itemIds: ["extra-gift-wrap"] } } };
      expect("extras" in applyTemplate(DEFAULT_SPEC, withGift)).toBe(false);
      expect(applyTemplate({ ...DEFAULT_SPEC, extras: NO_EXTRAS }, withGift).extras).toEqual(NO_EXTRAS);
      expect(templateLabel({ ...DEFAULT_SPEC, extras: NO_EXTRAS }, pilot)).toBe("Started from Slate Pilot.");
    });

    it("leaves a spare strap the new case can't take for the rules engine to flag, with a fix", () => {
      const pilot = template("tpl-slate-pilot");
      const next = applyTemplate(WITH_EXTRAS, pilot);
      expect(next.extras?.spareStrapId).toBe("strap-leather-brown-22");
      const spare = validateSpec(next).issues.find((issue) => issue.ruleId === "spare-strap");
      expect(spare?.severity).toBe("error");
      expect(spare?.slots).toEqual([]);
      const [fix] = spare?.fixes ?? [];
      expect(fix?.patch.extras).toBeDefined();
      const fixed = { ...next, ...fix.patch };
      expect(validateSpec(fixed).issues.some((issue) => issue.ruleId === "spare-strap" && issue.severity === "error")).toBe(
        false,
      );
      // The add-ons survive the fix.
      expect(fixed.extras?.itemIds).toEqual(WITH_EXTRAS.extras?.itemIds);
    });
  });

  it("lets the rules engine flag kept text the new dial can't take", () => {
    const next = applyTemplate(PERSONAL, template("tpl-roman-dress"));
    expect(next.personalization.dialText).toBe("Est. 1952");
    const dialText = validateSpec(next).issues.find((issue) => issue.ruleId === "dial-text");
    expect(dialText?.severity).toBe("error");
    expect(dialText?.fixes.length).toBeGreaterThan(0);
  });
});
