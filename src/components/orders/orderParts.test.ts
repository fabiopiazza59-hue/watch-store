import { describe, expect, it } from "vitest";
import { createBuildSheet } from "@/domain/buildSheet";
import { CATALOG, DEFAULT_SPEC, EXTRAS, resolveExtras, resolveSpec } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import type { Order } from "@/domain/types";
import { orderSchema } from "@/domain/schemas";
import { orderExtras, orderParts } from "./orderParts";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "ORD-20260927-ABCD",
    createdAt: "2026-09-27T10:00:00.000Z",
    status: "received",
    customer: { name: "Ada", email: "ada@example.com" },
    notes: "",
    spec: DEFAULT_SPEC,
    quote: priceSpec(DEFAULT_SPEC),
    buildSheet: createBuildSheet(DEFAULT_SPEC),
    ...overrides,
  } satisfies Order;
}

describe("orderParts", () => {
  it("reports no changes while the catalogue still matches the order", () => {
    const result = orderParts(order());
    expect(result.changes).toEqual([]);
    expect(result.parts).toEqual(resolveSpec(DEFAULT_SPEC));
  });

  it("sees no change in a copy read back from the order file, whose keys come back in another order", () => {
    const stored = orderSchema.parse(JSON.parse(JSON.stringify(order({ parts: resolveSpec(DEFAULT_SPEC) }))));
    expect(Object.keys(stored.parts?.case ?? {})).not.toEqual(Object.keys(resolveSpec(DEFAULT_SPEC).case ?? {}));
    expect(orderParts(stored).changes).toEqual([]);
  });

  it("uses the order's own copy of its parts, even for a part the catalogue no longer lists", () => {
    const dial = { ...CATALOG.dials[0], id: "dial-discontinued", name: "Field Olive (old run)" };
    const spec = { ...DEFAULT_SPEC, dialId: "dial-discontinued" };
    const result = orderParts(order({ spec, parts: { ...resolveSpec(DEFAULT_SPEC), dial } }));
    expect(result.parts.dial?.name).toBe("Field Olive (old run)");
    expect(result.orderedNames.dialId).toBe("Field Olive (old run)");
    expect(result.changes).toEqual([{ label: "Dial", ordered: "Field Olive (old run)", now: null }]);
  });

  it("notices a part whose catalogue entry changed since the copy was taken", () => {
    const [firstCase] = CATALOG.cases.filter((c) => c.id === DEFAULT_SPEC.caseId);
    const parts = { ...resolveSpec(DEFAULT_SPEC), case: { ...firstCase, lugWidthMm: firstCase.lugWidthMm + 2 } };
    expect(orderParts(order({ parts })).changes).toEqual([{ label: "Case", ordered: firstCase.name, now: firstCase.name }]);
  });

  it("falls back on the build sheet's names for older orders without a copy", () => {
    const spec = { ...DEFAULT_SPEC, dialId: "dial-discontinued" };
    const result = orderParts(order({ spec }));
    const dialName = createBuildSheet(DEFAULT_SPEC).bom.find((line) => line.slot === "dialId")?.name;
    expect(result.parts.dial).toBeUndefined();
    expect(result.orderedNames.dialId).toBe(dialName);
    expect(result.changes).toEqual([{ label: "Dial", ordered: dialName, now: null }]);
  });
});

describe("orderExtras", () => {
  const spec = { ...DEFAULT_SPEC, extras: { spareStrapId: "strap-nato-navy-22", itemIds: [EXTRAS[0].id] } };

  it("uses the order's own copy of its extras, even for ones the catalogue has changed or dropped", () => {
    const box = { ...EXTRAS[0], name: "Walnut box (old run)" };
    const extras = orderExtras(order({ spec, extras: { spareStrap: undefined, items: [box] } }));
    expect(extras.items.map((item) => item.name)).toEqual(["Walnut box (old run)"]);
    expect(extras.spareStrap).toBeUndefined();
  });

  it("falls back on today's catalogue without a copy, and has none for orders from before extras", () => {
    expect(orderExtras(order({ spec }))).toEqual(resolveExtras(spec));
    expect(orderExtras(order({ spec })).spareStrap?.id).toBe("strap-nato-navy-22");
    expect(orderExtras(order())).toEqual({ spareStrap: undefined, items: [] });
  });
});
