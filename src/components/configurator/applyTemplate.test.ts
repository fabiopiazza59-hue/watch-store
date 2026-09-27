import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, type DesignTemplate, TEMPLATES } from "@/domain/catalog";
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

  it("lets the rules engine flag kept text the new dial can't take", () => {
    const next = applyTemplate(PERSONAL, template("tpl-roman-dress"));
    expect(next.personalization.dialText).toBe("Est. 1952");
    const dialText = validateSpec(next).issues.find((issue) => issue.ruleId === "dial-text");
    expect(dialText?.severity).toBe("error");
    expect(dialText?.fixes.length).toBeGreaterThan(0);
  });
});
