import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { formatCost, formatPrice } from "../ui/format";
import { QuoteBreakdown } from "./QuoteBreakdown";

const quote = priceSpec({ ...DEFAULT_SPEC, personalization: { dialText: "Est 1952", casebackEngraving: "" } });

describe("QuoteBreakdown", () => {
  it("shows customers what the price includes and its VAT, not the workshop's costs", () => {
    const markup = renderToStaticMarkup(<QuoteBreakdown quote={quote} variant="customer" />);
    expect(markup).not.toMatch(/Workshop margin|Cost to make|Suggested|Payment fee|Warranty reserve/);
    expect(markup).not.toContain(formatCost(quote.totalCostEur));
    expect(markup).toContain("UV-printed dial text");
    expect(markup).toContain(`Your price, incl. ${quote.vatRatePct}% VAT`);
    expect(markup).toContain(formatPrice(quote.retailInclVatEur));
    expect(markup).toContain(formatCost(quote.vatEur));
  });

  it("gives the workshop every cost line down to the margin", () => {
    const markup = renderToStaticMarkup(<QuoteBreakdown quote={quote} variant="workshop" />);
    expect(markup).toContain("Cost to make");
    expect(markup).toContain(`Workshop margin (${quote.marginPct}%)`);
    expect(markup).toContain(formatCost(quote.totalCostEur));
    expect(markup).toContain(formatPrice(quote.retailInclVatEur));
  });

  it("drops the VAT lines for a VAT-exempt quote", () => {
    const exempt = { ...quote, vatRatePct: 0, vatEur: 0, retailInclVatEur: quote.suggestedRetailEur };
    const markup = renderToStaticMarkup(<QuoteBreakdown quote={exempt} variant="customer" />);
    expect(markup).not.toContain("Price excl. VAT");
    expect(markup).toContain("Your price, no VAT charged");
  });
});
