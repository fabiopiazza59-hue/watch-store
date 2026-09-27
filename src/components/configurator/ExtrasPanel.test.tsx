import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CATALOG, DEFAULT_SPEC, EXTRAS, resolveSpec } from "@/domain/catalog";
import { validateSpec } from "@/domain/rules";
import type { WatchSpec } from "@/domain/types";
import { ExtrasPanel } from "./ExtrasPanel";

function render(spec: WatchSpec): string {
  return renderToStaticMarkup(
    <ExtrasPanel
      spec={spec}
      parts={resolveSpec(spec)}
      report={validateSpec(spec)}
      onChange={() => {}}
      onApplyFix={() => {}}
    />,
  );
}

/** Radio and checkbox inputs in the markup, with whether each is checked. */
function inputs(markup: string, type: "radio" | "checkbox"): { value: string; checked: boolean }[] {
  return [...markup.matchAll(new RegExp(`<input type="${type}"[^>]*>`, "g"))].map(([tag]) => ({
    value: /value="([^"]*)"/.exec(tag)?.[1] ?? "",
    checked: / checked=""/.test(tag),
  }));
}

describe("ExtrasPanel", () => {
  it("offers no spare strap first, then only the straps that fit the case, and every add-on", () => {
    const markup = render(DEFAULT_SPEC);
    const radios = inputs(markup, "radio");
    expect(radios[0]).toEqual({ value: "none", checked: true });
    const listed = radios.slice(1).map((radio) => CATALOG.straps.find((strap) => strap.id === radio.value));
    expect(listed.length).toBeGreaterThan(0);
    for (const strap of listed) expect(strap?.widthMm).toBe(22);
    const hidden = CATALOG.straps.length - listed.length;
    expect(markup).toContain(`Show ${hidden} more that won&#x27;t fit`);
    expect(markup).toContain("fit this case&#x27;s 22 mm lugs");

    const boxes = inputs(markup, "checkbox");
    expect(boxes).toHaveLength(EXTRAS.length);
    expect(boxes.every((box) => !box.checked)).toBe(true);
    for (const extra of EXTRAS) expect(markup).toContain(extra.name);
    expect(markup).toContain("In the box");
    expect(markup).toContain("At the bench");
    expect(markup).not.toContain("Your extras add");
  });

  it("shows the chosen extras, and keeps a spare strap that no longer fits in view with its fixes", () => {
    const spec: WatchSpec = {
      ...DEFAULT_SPEC,
      extras: { spareStrapId: "strap-leather-tan-20", itemIds: [EXTRAS[0].id] },
    };
    const markup = render(spec);
    expect(inputs(markup, "radio").find((radio) => radio.checked)?.value).toBe("strap-leather-tan-20");
    expect(inputs(markup, "checkbox").filter((box) => box.checked)).toHaveLength(1);
    expect(markup).toContain("Needs a change");
    expect(markup).toContain("Won&#x27;t fit");
    expect(markup).toMatch(/aria-label="Apply: [^"]+"/);
    expect(markup).toContain("Your extras add");
  });
});
