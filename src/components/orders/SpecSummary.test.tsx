import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CATALOG, DEFAULT_SPEC, EXTRAS, resolveSpec } from "@/domain/catalog";
import { SpecSummary } from "./SpecSummary";

describe("SpecSummary", () => {
  const spec = { ...DEFAULT_SPEC, dialId: "dial-discontinued" };

  it("shows the ordered part from the order's copy when the catalogue no longer lists it", () => {
    const dial = { ...CATALOG.dials[0], id: "dial-discontinued", name: "Old Olive" };
    const markup = renderToStaticMarkup(<SpecSummary spec={spec} parts={{ ...resolveSpec(DEFAULT_SPEC), dial }} />);
    expect(markup).toContain("Old Olive");
    expect(markup).not.toContain("Missing part");
  });

  it("falls back on the name as ordered, and says a part is missing only when nothing names it", () => {
    expect(renderToStaticMarkup(<SpecSummary spec={spec} orderedNames={{ dialId: "Old Olive" }} />)).toContain("Old Olive");
    expect(renderToStaticMarkup(<SpecSummary spec={spec} />)).toContain("Missing part");
    expect(renderToStaticMarkup(<SpecSummary spec={{ ...DEFAULT_SPEC, bezelInsertId: null }} />)).toContain("None");
  });

  it("lists the spare strap and add-ons, from the order's copy when given one", () => {
    const extras = { spareStrapId: "strap-nato-navy-22", itemIds: [EXTRAS[0].id, EXTRAS[3].id] };
    const withExtras = { ...DEFAULT_SPEC, extras };
    const markup = renderToStaticMarkup(<SpecSummary spec={withExtras} />);
    expect(markup).toContain("Spare strap");
    expect(markup).toContain("Navy NATO 22mm");
    expect(markup).toContain("Add-ons");
    expect(markup).toContain(EXTRAS[0].name);
    expect(markup).toContain(EXTRAS[3].name);
    expect(markup).not.toContain(EXTRAS[0].supplierHint);

    const copy = { spareStrap: undefined, items: [{ ...EXTRAS[0], name: "Walnut box (old run)" }] };
    const ordered = renderToStaticMarkup(<SpecSummary spec={withExtras} extras={copy} />);
    expect(ordered).toContain("Walnut box (old run)");
    expect(ordered).not.toContain("Spare strap");
  });

  it("says nothing about extras when there are none", () => {
    const markup = renderToStaticMarkup(<SpecSummary spec={DEFAULT_SPEC} />);
    expect(markup).not.toMatch(/Spare strap|Add-ons/);
  });
});
