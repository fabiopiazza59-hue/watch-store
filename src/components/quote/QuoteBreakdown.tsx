import type { PriceLine, PriceQuote } from "@/domain/types";
import { formatCost, formatPrice } from "../ui/format";

const GROUPS: { title: string; kinds: PriceLine["kind"][] }[] = [
  { title: "Parts", kinds: ["part"] },
  { title: "Personalization", kinds: ["personalization"] },
  { title: "Bench work and QC", kinds: ["labour", "qc"] },
  { title: "Packaging, shipping and warranty", kinds: ["overhead"] },
];

const sum = (lines: PriceLine[]) => lines.reduce((total, line) => total + line.amountEur, 0);

/** Every cost line of a quote, grouped by kind, down to the margin and the suggested price. */
export function QuoteBreakdown({ quote }: { quote: PriceQuote }) {
  const marginEur = quote.suggestedRetailEur - quote.totalCostEur;
  return (
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
        <tr>
          <th scope="row" className="pt-1 pr-4 text-left font-semibold text-ink">
            Suggested price, excl. VAT
          </th>
          <td className="pt-1 text-right font-semibold text-ink tabular-nums">{formatPrice(quote.suggestedRetailEur)}</td>
        </tr>
      </tbody>
    </table>
  );
}
