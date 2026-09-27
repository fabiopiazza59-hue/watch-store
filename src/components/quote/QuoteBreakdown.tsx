import type { PriceLine, PriceQuote } from "@/domain/types";
import { formatCost, formatPrice, vatNote } from "../ui/format";

const GROUPS: { title: string; kinds: PriceLine["kind"][] }[] = [
  { title: "Parts", kinds: ["part"] },
  { title: "Personalization", kinds: ["personalization"] },
  { title: "Bench work and QC", kinds: ["labour", "qc"] },
  { title: "Packaging, shipping, warranty and fees", kinds: ["overhead"] },
];

const sum = (lines: PriceLine[]) => lines.reduce((total, line) => total + line.amountEur, 0);

interface QuoteBreakdownProps {
  quote: PriceQuote;
  /**
   * "customer": what the price includes and its VAT, without the workshop's costs and margin.
   * "workshop": every cost line, down to the margin.
   */
  variant: "customer" | "workshop";
}

export function QuoteBreakdown({ quote, variant }: QuoteBreakdownProps) {
  return variant === "customer" ? <CustomerBreakdown quote={quote} /> : <WorkshopBreakdown quote={quote} />;
}

/** The customer's view: the parts and work the price covers, then the price with its VAT. */
function CustomerBreakdown({ quote }: { quote: PriceQuote }) {
  const personal = quote.lines.filter((line) => line.kind === "personalization");
  const included = [
    ...quote.lines.filter((line) => line.kind === "part").map((line) => line.label),
    ...personal.map((line) => line.label),
    "Assembly, regulation and a 24-hour test, by hand",
    "Timegrapher and pressure test before it ships",
    "Packaging and insured, tracked shipping",
  ];
  return (
    <div className="text-sm">
      <p className="pt-3 text-xs font-medium tracking-[0.1em] text-ink-faint uppercase">Included</p>
      <ul className="mt-1 flex flex-col gap-1 border-b border-line pb-3 text-ink-soft">
        {included.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
      <PriceTotals quote={quote} />
    </div>
  );
}

/** Price excluding VAT, the VAT, and the price paid. */
function PriceTotals({ quote }: { quote: PriceQuote }) {
  return (
    <table className="mt-2 w-full text-sm">
      <caption className="sr-only">Price and VAT</caption>
      <tbody>
        {quote.vatRatePct > 0 && (
          <>
            <tr>
              <th scope="row" className="py-1 pr-4 text-left font-normal text-ink-soft">
                Price excl. VAT
              </th>
              <td className="py-1 text-right text-ink-soft tabular-nums">{formatCost(quote.suggestedRetailEur)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1 pr-4 text-left font-normal text-ink-soft">
                VAT ({quote.vatRatePct}%)
              </th>
              <td className="py-1 text-right text-ink-soft tabular-nums">{formatCost(quote.vatEur)}</td>
            </tr>
          </>
        )}
        <tr>
          <th scope="row" className="pt-1 pr-4 text-left font-semibold text-ink">
            Your price, {vatNote(quote)}
          </th>
          <td className="pt-1 text-right font-semibold text-ink tabular-nums">{formatPrice(quote.retailInclVatEur)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Every cost line of a quote, grouped by kind, down to the margin and the price. */
function WorkshopBreakdown({ quote }: { quote: PriceQuote }) {
  const marginEur = quote.suggestedRetailEur - quote.totalCostEur;
  return (
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">Cost breakdown</caption>
        {GROUPS.map(({ title, kinds }) => {
          const lines = quote.lines.filter((line) => kinds.includes(line.kind));
          if (lines.length === 0) return null;
          return (
            <tbody key={title} className="border-b border-line">
              <tr>
                <th scope="rowgroup" colSpan={2} className="pt-3 pb-1 text-left text-xs font-medium tracking-[0.1em] text-ink-faint uppercase">
                  {title}
                </th>
              </tr>
              {lines.map((line, index) => (
                <tr key={`${line.label}-${index}`}>
                  <td className="py-1 pr-4 text-ink-soft">{line.label}</td>
                  <td className="py-1 text-right text-ink-soft tabular-nums">{formatCost(line.amountEur)}</td>
                </tr>
              ))}
              <tr>
                <td className="pt-1 pb-3 pr-4 text-ink">Subtotal</td>
                <td className="pt-1 pb-3 text-right font-medium text-ink tabular-nums">{formatCost(sum(lines))}</td>
              </tr>
            </tbody>
          );
        })}
        <tbody>
          <tr>
            <th scope="row" className="pt-3 pr-4 text-left font-medium text-ink">
              Cost to make
            </th>
            <td className="pt-3 text-right font-medium text-ink tabular-nums">{formatCost(quote.totalCostEur)}</td>
          </tr>
          <tr>
            <th scope="row" className="py-1 pr-4 text-left font-normal text-ink-soft">
              Workshop margin ({quote.marginPct}%)
            </th>
            <td className="py-1 text-right text-ink-soft tabular-nums">{formatCost(marginEur)}</td>
          </tr>
        </tbody>
      </table>
      <PriceTotals quote={quote} />
    </div>
  );
}
