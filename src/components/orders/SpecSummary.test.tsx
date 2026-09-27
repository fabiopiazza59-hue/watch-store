import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CATALOG, DEFAULT_SPEC, resolveSpec } from "@/domain/catalog";
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
});
