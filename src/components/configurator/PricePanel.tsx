import type { PriceQuote } from "@/domain/types";
import { QuoteBreakdown } from "../quote/QuoteBreakdown";
import { formatPrice, plural, vatNote } from "../ui/format";
import { ChevronIcon } from "../ui/icons";
import { cardClass, eyebrowClass } from "../ui/styles";

export function PricePanel({ quote }: { quote: PriceQuote }) {
  return (
    <section aria-labelledby="price-title" className={`${cardClass} p-5 sm:p-6`}>
      <h2 id="price-title" className={eyebrowClass}>
        Your price
      </h2>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <p>
          <span className="font-display text-4xl font-semibold tracking-tight text-ink tabular-nums">
            {formatPrice(quote.retailInclVatEur)}
          </span>
          <span className="ml-2 text-sm text-ink-faint">{vatNote(quote)}</span>
        </p>
        <p className="text-sm text-ink-soft">
          Ready to ship in about <strong className="font-semibold text-ink">{plural(quote.leadTimeDays, "day")}</strong>
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        Worked out from today&rsquo;s part prices and bench time; we confirm it by email before any parts are ordered.
        Lead time is the slowest part to arrive, plus assembly, regulation and a 24-hour test.
      </p>
      <details className="group mt-4 border-t border-line pt-1">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md py-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          What&rsquo;s in the price
          <ChevronIcon className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <QuoteBreakdown quote={quote} variant="customer" />
      </details>
    </section>
  );
}
