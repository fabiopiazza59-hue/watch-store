import type { PriceQuote } from "@/domain/types";
import { QuoteBreakdown } from "../quote/QuoteBreakdown";
import { formatPrice, plural } from "../ui/format";
import { ChevronIcon } from "../ui/icons";
import { cardClass, eyebrowClass } from "../ui/styles";

export function PricePanel({ quote }: { quote: PriceQuote }) {
  return (
    <section aria-labelledby="price-title" className={`${cardClass} p-5 sm:p-6`}>
      <h2 id="price-title" className={eyebrowClass}>
        Estimated price
      </h2>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <p>
          <span className="font-display text-4xl font-semibold tracking-tight text-ink tabular-nums">
            {formatPrice(quote.suggestedRetailEur)}
          </span>
          <span className="ml-2 text-sm text-ink-faint">excl. VAT</span>
        </p>
        <p className="text-sm text-ink-soft">
          Ready to ship in about <strong className="font-semibold text-ink">{plural(quote.leadTimeDays, "day")}</strong>
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        An estimate from today&rsquo;s part costs and bench time. Lead time is the slowest part to arrive, plus
        assembly, regulation and a 24-hour test.
      </p>
      <details className="group mt-4 border-t border-line pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          See the full cost breakdown
          <ChevronIcon className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2">
          <QuoteBreakdown quote={quote} />
        </div>
      </details>
    </section>
  );
}
