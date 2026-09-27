import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC } from "@/domain/catalog";
import { repairSpec, validateSpec } from "@/domain/rules";
import type { WatchSpec } from "@/domain/types";
import { FeasibilityPanel } from "./FeasibilityPanel";

function render(spec: WatchSpec): string {
  return renderToStaticMarkup(
    <FeasibilityPanel
      spec={spec}
      report={validateSpec(spec)}
      onChange={() => {}}
      onRepair={() => ({ result: repairSpec(spec), keptPart: null })}
      undoableSpec={null}
      onUndo={() => {}}
      onRevealSlot={() => {}}
      onRevealExtras={() => {}}
    />,
  );
}

describe("FeasibilityPanel", () => {
  it("counts a spare strap that doesn't fit as a change to make, pointing at the extras, with its fixes", () => {
    const markup = render({ ...DEFAULT_SPEC, extras: { spareStrapId: "strap-leather-tan-20", itemIds: [] } });
    expect(markup).toContain("Needs changes");
    expect(markup).toContain("1 thing would stop us");
    expect(markup).toMatch(/Involves<\/span><button[^>]*>Extras<\/button>/);
    expect(markup).toContain("Remove the spare strap");
    expect(markup).toContain("Fix everything for me");
  });

  it("gives issues about parts no Extras chip", () => {
    const markup = render({ ...DEFAULT_SPEC, strapId: "strap-leather-tan-20" });
    expect(markup).toContain("Involves");
    expect(markup).not.toMatch(/>Extras<\/button>/);
  });
});
