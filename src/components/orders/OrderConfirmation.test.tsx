import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createBuildSheet } from "@/domain/buildSheet";
import { TEMPLATES } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import type { Order } from "@/domain/types";
import { formatPrice } from "../ui/format";
import { OrderConfirmation } from "./OrderConfirmation";

const spec = { ...TEMPLATES[0].spec, personalization: { dialText: "Est 1952", casebackEngraving: "" } };
const order: Order = {
  id: "ORD-20260927-0123456789ABCDEF",
  createdAt: "2026-09-27T10:00:00.000Z",
  status: "received",
  customer: { name: "Sam Carter", email: "sam@example.com" },
  notes: "Needed by 10 June, please!",
  spec,
  quote: priceSpec(spec),
  buildSheet: createBuildSheet(spec),
};

describe("OrderConfirmation", () => {
  const markup = renderToStaticMarkup(<OrderConfirmation order={order} />);

  it("shows the customer their watch, price and what happens next", () => {
    expect(markup).toContain("Your order is in");
    expect(markup).toContain(order.id);
    expect(markup).toContain(formatPrice(order.quote.retailInclVatEur));
    expect(markup).toContain("What happens next");
    expect(markup).toContain('href="/"');
  });

  it("keeps the workshop's view and the customer's personal details out", () => {
    expect(markup).not.toMatch(/Workshop margin|Cost to make|Build sheet|Bill of materials|<select/);
    expect(markup).not.toMatch(/href="\/orders/);
    expect(markup).not.toContain("sam@example.com");
    expect(markup).not.toContain("Needed by 10 June");
    for (const line of order.buildSheet.bom) expect(markup).not.toContain(line.supplierHint);
  });
});
