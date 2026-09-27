import Link from "next/link";
import type { Order } from "@/domain/types";
import { WatchPreview } from "../preview/WatchPreview";
import { formatDate, formatPrice, plural, vatNote } from "../ui/format";
import { CheckIcon } from "../ui/icons";
import { buttonClass, cardClass, eyebrowClass } from "../ui/styles";
import { orderExtras, orderParts } from "./orderParts";
import { SpecSummary } from "./SpecSummary";

/**
 * What a customer sees once their order is placed: the watch, what it costs and what happens next.
 * Deliberately nothing from the workshop's view: no costs or margin, no build sheet, no status
 * controls, no contact details and no way into the order queue.
 */
export function OrderConfirmation({ order }: { order: Order }) {
  const { parts, orderedNames } = orderParts(order);
  const designName = order.spec.name.trim() || "Your watch";
  const { quote } = order;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-16 sm:px-6 lg:pt-12">
      <div role="status" className="flex items-start gap-4 rounded-xl border border-ok/25 bg-ok-soft p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ok text-paper">
          <CheckIcon className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Thank you. Your order is in.</h1>
          <p className="mt-1 leading-relaxed text-ink-soft">
            We&rsquo;ll email you to confirm the details before we order any parts. Nothing has been charged.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Order number <span className="font-mono text-ink">{order.id}</span>, placed {formatDate(order.createdAt)}.
            Keep this page&rsquo;s address to come back to it.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section aria-labelledby="watch-title" className={`${cardClass} p-5 sm:p-6`}>
          <h2 id="watch-title" className="font-display text-2xl font-semibold tracking-tight break-words text-ink">
            {designName}
          </h2>
          <div className="mx-auto mt-4 aspect-square w-full max-w-[340px] overflow-hidden">
            <WatchPreview parts={parts} personalization={order.spec.personalization} size={340} className="h-auto w-full" />
          </div>
          <div className="mt-4">
            <SpecSummary spec={order.spec} parts={parts} orderedNames={orderedNames} extras={orderExtras(order)} />
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="price-title" className={`${cardClass} p-5 sm:p-6`}>
            <h2 id="price-title" className={eyebrowClass}>
              Your price
            </h2>
            <p className="mt-2">
              <span className="font-display text-4xl font-semibold tracking-tight text-ink tabular-nums">
                {formatPrice(quote.retailInclVatEur)}
              </span>
              <span className="ml-2 text-sm text-ink-faint">{vatNote(quote)}</span>
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Ready to ship in about <strong className="font-semibold text-ink">{plural(quote.leadTimeDays, "day")}</strong>{" "}
              from when you confirm.
            </p>
          </section>

          <section aria-labelledby="next-title" className={`${cardClass} p-5 sm:p-6`}>
            <h2 id="next-title" className="font-display text-xl font-semibold text-ink">
              What happens next
            </h2>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 leading-relaxed text-ink-soft marker:text-brass-ink">
              <li>We check your design once more and email you to confirm it, the price and how to pay.</li>
              <li>Once you confirm, we order the parts. The slowest to arrive sets the lead time.</li>
              <li>We assemble your watch by hand, regulate it and run it for 24 hours.</li>
              <li>It passes its timekeeping and pressure checks, then ships to you insured and tracked.</li>
            </ol>
          </section>

          <Link href="/" className={`${buttonClass("secondary", "md")} self-start`}>
            Back to the configurator
          </Link>
        </div>
      </div>
    </div>
  );
}
