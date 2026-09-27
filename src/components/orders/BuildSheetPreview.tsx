"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { createBuildSheet } from "@/domain/buildSheet";
import { DEFAULT_SPEC, resolveSpec, specExtras } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { validateSpec } from "@/domain/rules";
import { decodeSpec, SHARE_PARAM } from "../configurator/specCodec";
import { WatchPreview } from "../preview/WatchPreview";
import { QuoteBreakdown } from "../quote/QuoteBreakdown";
import { formatPrice, plural, vatNote } from "../ui/format";
import { cardClass, eyebrowClass } from "../ui/styles";
import { BuildSheetView } from "./BuildSheetView";
import { PrintButton } from "./PrintButton";
import { SpecSummary } from "./SpecSummary";

/** Checklist ticks for this preview are kept apart from real orders' ticks. */
const PREVIEW_ID = "preview";

/**
 * The demo's stand-in for an order: the build sheet for the design in the link, worked out in the
 * browser exactly as an order would get it. The demo is public, so it shows the customer's price
 * and leaves out the workshop's costs.
 */
export function BuildSheetPreview() {
  const shared = useSearchParams().get(SHARE_PARAM);
  const spec = useMemo(() => (shared ? decodeSpec(shared) : null) ?? DEFAULT_SPEC, [shared]);
  const report = useMemo(() => validateSpec(spec), [spec]);
  const quote = useMemo(() => priceSpec(spec), [spec]);
  const sheet = useMemo(() => createBuildSheet(spec), [spec]);
  const parts = resolveSpec(spec);
  const backHref = shared ? { pathname: "/", query: { [SHARE_PARAM]: shared } } : "/";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 lg:pt-10 print:max-w-none print:p-0">
      <Link
        href={backHref}
        className="inline-block py-1.5 text-sm text-ink-faint underline decoration-line-strong underline-offset-4 hover:text-ink print:hidden"
      >
        &larr; Back to the design
      </Link>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className={eyebrowClass}>Build sheet preview</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight break-words text-ink sm:text-5xl">
            {spec.name.trim() || "Untitled design"}
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
            In this demo, ordering is switched off. This is what the workshop works from with an order: the parts to
            buy, and the steps and checks to build this watch by hand.
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </header>

      {!report.buildable && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          This design can&rsquo;t be built yet, so no order would be accepted for it. Go back to the design to fix what the
          rules engine flags.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="The watch" className={`${cardClass} p-5 sm:p-6`}>
          <div className="mx-auto aspect-square w-full max-w-[360px] overflow-hidden print:max-w-[200px]">
            <WatchPreview parts={parts} personalization={spec.personalization} size={360} className="h-auto w-full max-w-full" />
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold text-ink">Specification</h2>
          <div className="mt-2">
            <SpecSummary spec={spec} parts={parts} />
          </div>
        </section>

        <section aria-labelledby="quote-title" className={`${cardClass} p-5 sm:p-6 print:hidden`}>
          <h2 id="quote-title" className={eyebrowClass}>
            Price
          </h2>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <p>
              <span className="font-display text-4xl font-semibold tracking-tight tabular-nums">
                {formatPrice(quote.retailInclVatEur)}
              </span>
              <span className="ml-2 text-sm text-ink-faint">{vatNote(quote)}</span>
            </p>
            <p className="text-sm text-ink-soft">
              Lead time about <strong className="font-semibold text-ink">{plural(quote.leadTimeDays, "day")}</strong>
            </p>
          </div>
          <div className="mt-3 border-t border-line">
            <QuoteBreakdown quote={quote} variant="customer" />
          </div>
        </section>
      </div>

      <div className="mt-8">
        <BuildSheetView
          sheet={sheet}
          orderId={PREVIEW_ID}
          spareStrapId={specExtras(spec).spareStrapId}
          showCosts={false}
        />
      </div>
    </div>
  );
}
