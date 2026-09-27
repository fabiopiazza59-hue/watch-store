import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EXTRAS } from "@/domain/catalog";
import type { BomLine, BuildSheet } from "@/domain/types";
import { BuildSheetView, bomSlotLabel } from "./BuildSheetView";

const line = (slot: BomLine["slot"], partId: string | null, name = "Part"): BomLine => ({
  slot,
  partId,
  name,
  qty: 1,
  unitCostEur: 10,
  supplierHint: "Somewhere",
});

describe("bomSlotLabel", () => {
  it("names part slots, personalization, the spare strap and the other extras", () => {
    expect(bomSlotLabel(line("dialId", "dial-diver-black"))).toBe("Dial");
    expect(bomSlotLabel(line("personalization", null))).toBe("Personalization");
    expect(bomSlotLabel(line("extra", "strap-nato-navy-22"), "strap-nato-navy-22")).toBe("Spare strap");
    expect(bomSlotLabel(line("extra", EXTRAS[0].id), "strap-nato-navy-22")).toBe("Extra");
    expect(bomSlotLabel(line("extra", EXTRAS[0].id), null)).toBe("Extra");
  });

  it("tells the spare strap by the catalogue when the order's spare strap isn't given", () => {
    expect(bomSlotLabel(line("extra", "strap-nato-navy-22"))).toBe("Spare strap");
    expect(bomSlotLabel(line("extra", EXTRAS[0].id))).toBe("Extra");
  });
});

const sheetWith = (bom: BomLine[]): BuildSheet => ({
  title: "Build sheet",
  summary: "",
  bom,
  tools: [],
  steps: [],
  qcChecks: [],
  notes: [],
  estimatedBenchMinutes: 90,
});

describe("BuildSheetView", () => {
  it("shows unit costs and the materials total by default", () => {
    const markup = renderToStaticMarkup(<BuildSheetView sheet={sheetWith([line("dialId", "dial-diver-black")])} orderId="ORD-1" />);
    expect(markup).toContain("Materials total");
    expect(markup).toMatch(/€\s?10/);
  });

  it("leaves every cost out when showCosts is off, keeping parts and quantities", () => {
    const bom = [line("dialId", "dial-diver-black", "Diver Black"), line("strapId", "strap-rubber-black-22", "Black rubber")];
    const markup = renderToStaticMarkup(
      <BuildSheetView sheet={sheetWith(bom)} orderId="preview" showCosts={false} />,
    );
    expect(markup).toContain("Diver Black");
    expect(markup).toContain("Qty 1");
    expect(markup).not.toContain("Materials total");
    expect(markup).not.toContain("€");
  });

  it("lists the extras in the bill of materials", () => {
    const sheet: BuildSheet = {
      title: "Build sheet",
      summary: "",
      bom: [
        line("strapId", "strap-rubber-black-22", "Black rubber 22mm"),
        line("extra", "strap-nato-navy-22", "Navy NATO 22mm"),
        line("extra", EXTRAS[0].id, EXTRAS[0].name),
      ],
      tools: [],
      steps: [],
      qcChecks: [],
      notes: [],
      estimatedBenchMinutes: 90,
    };
    const markup = renderToStaticMarkup(<BuildSheetView sheet={sheet} orderId="ORD-1" spareStrapId="strap-nato-navy-22" />);
    expect(markup).toContain("Spare strap");
    expect(markup).toContain("Navy NATO 22mm");
    expect(markup).toContain(`>Extra<`);
    expect(markup).toContain(EXTRAS[0].name);
  });
});
