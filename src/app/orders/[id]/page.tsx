import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildSheetView } from "@/components/orders/BuildSheetView";
import { type CatalogueChange, orderParts } from "@/components/orders/orderParts";
import { PrintButton } from "@/components/orders/PrintButton";
import { SpecSummary } from "@/components/orders/SpecSummary";
import { StatusSelector } from "@/components/orders/StatusSelector";
import { WorkshopSignIn } from "@/components/orders/WorkshopSignIn";
import { WatchPreview } from "@/components/preview/WatchPreview";
import { QuoteBreakdown } from "@/components/quote/QuoteBreakdown";
import { formatDateTime, formatPrice, mailtoHref, plural, vatNote } from "@/components/ui/format";
import { AlertIcon } from "@/components/ui/icons";
import { cardClass, eyebrowClass } from "@/components/ui/styles";
import type { Order } from "@/domain/types";
import { CorruptOrderError, getOrder } from "@/server/orders";
import { canSeeWorkshop } from "../workshopGate";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id}`, robots: { index: false, follow: false } };
}

/** The workshop's view of one order: status, customer, costs and the build sheet. */
export default async function OrderPage({ params }: OrderPageProps) {
  if (!(await canSeeWorkshop())) return <WorkshopSignIn />;
  const { id } = await params;
  let order: Order | null;
  try {
    order = await getOrder(id);
  } catch (error) {
    if (error instanceof CorruptOrderError) return <DamagedOrder error={error} />;
    throw error;
  }
  if (!order) notFound();
  const designName = order.spec.name.trim() || "Untitled design";
  const { parts, orderedNames, changes } = orderParts(order);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 lg:pt-10 print:max-w-none print:p-0">
      <PrintRunningHead orderId={order.id} />
      <Link
        href="/orders"
        className="inline-block py-1.5 text-sm text-ink-faint underline decoration-line-strong underline-offset-4 hover:text-ink print:hidden"
      >
        &larr; Workshop queue
      </Link>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className={eyebrowClass}>
            Order <span className="font-mono tracking-normal">{order.id}</span>
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight break-words text-ink sm:text-5xl">
            {designName}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Placed {formatDateTime(order.createdAt)} by {order.customer.name} &middot;{" "}
            <a href={mailtoHref(order.customer.email)} className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              {order.customer.email}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3 print:hidden">
          <StatusSelector orderId={order.id} status={order.status} />
          <div className="pt-5">
            <PrintButton />
          </div>
        </div>
      </header>

      {changes.length > 0 && <CatalogueChanges changes={changes} />}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="The watch" className={`${cardClass} p-5 sm:p-6`}>
          <div className="mx-auto aspect-square w-full max-w-[360px] overflow-hidden print:max-w-[200px]">
            <WatchPreview
              parts={parts}
              personalization={order.spec.personalization}
              size={360}
              className="h-auto w-full max-w-full"
            />
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold text-ink">Specification</h2>
          <div className="mt-2">
            <SpecSummary spec={order.spec} parts={parts} orderedNames={orderedNames} />
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="quote-title" className={`${cardClass} p-5 sm:p-6 print:hidden`}>
            <h2 id="quote-title" className={eyebrowClass}>
              Quote at time of order
            </h2>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <p>
                <span className="font-display text-4xl font-semibold tracking-tight tabular-nums">
                  {formatPrice(order.quote.retailInclVatEur)}
                </span>
                <span className="ml-2 text-sm text-ink-faint">{vatNote(order.quote)}</span>
              </p>
              <p className="text-sm text-ink-soft">
                Lead time about <strong className="font-semibold text-ink">{plural(order.quote.leadTimeDays, "day")}</strong>
              </p>
            </div>
            <div className="mt-3 border-t border-line">
              <QuoteBreakdown quote={order.quote} variant="workshop" />
            </div>
          </section>

          <section aria-labelledby="notes-title" className={`${cardClass} p-5 sm:p-6`}>
            <h2 id="notes-title" className={eyebrowClass}>
              Customer notes
            </h2>
            <p className="mt-2 leading-relaxed whitespace-pre-line text-ink-soft">
              {order.notes.trim() || "No notes with this order."}
            </p>
          </section>
        </div>
      </div>

      <div className="mt-8">
        <BuildSheetView sheet={order.buildSheet} orderId={order.id} />
      </div>
    </div>
  );
}

/** An order file that exists but can't be read: say which, instead of failing the page. */
function DamagedOrder({ error }: { error: CorruptOrderError }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12">
      <Link
        href="/orders"
        className="inline-block py-1.5 text-sm text-ink-faint underline decoration-line-strong underline-offset-4 hover:text-ink"
      >
        &larr; Workshop queue
      </Link>
      <div role="alert" className="mt-6 flex gap-3 rounded-xl border border-danger/25 bg-danger-soft p-5">
        <AlertIcon className="mt-1 size-5 shrink-0 text-danger" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">This order file is damaged</h1>
          <p className="mt-2 leading-relaxed text-ink-soft">
            <span className="font-mono text-sm text-ink">{error.orderId}.json</span> can&rsquo;t be read, so the order
            can&rsquo;t be shown. Fix the file or restore it from a backup.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs whitespace-pre-wrap text-ink-soft">
            {error.problem}
          </pre>
        </div>
      </div>
    </div>
  );
}

/** "Dial: Field Olive is no longer listed." */
function describeChange({ label, ordered, now }: CatalogueChange): string {
  if (now === null) return `${label}: ${ordered} is no longer listed.`;
  if (now === ordered) return `${label}: ${ordered} has been edited in the catalogue.`;
  return `${label}: ${ordered} is now listed as ${now}.`;
}

/** Parts whose catalogue entry changed after the order: the build sheet, a copy taken at the time, is what counts. */
function CatalogueChanges({ changes }: { changes: CatalogueChange[] }) {
  return (
    <div role="note" className="mt-6 flex gap-3 rounded-xl border border-warn/25 bg-warn-soft/60 p-4 text-sm">
      <AlertIcon className="mt-0.5 size-4 shrink-0 text-warn" />
      <div>
        <p className="font-medium text-ink">The parts catalogue has changed since this order was placed.</p>
        <ul className="mt-1 list-disc pl-5 text-ink-soft">
          {changes.map((change) => (
            <li key={change.label}>{describeChange(change)}</li>
          ))}
        </ul>
        <p className="mt-1 text-ink-soft">The build sheet below lists the parts as they were ordered.</p>
      </div>
    </div>
  );
}

/**
 * The order number and page count in the margins of every printed page, so loose sheets on the bench
 * stay with their order. Order ids are `ORD-<digits>-<hex>`; anything else is dropped before the id
 * goes into CSS.
 */
function PrintRunningHead({ orderId }: { orderId: string }) {
  const text = "font-family: ui-monospace, monospace; font-size: 8pt; color: #444;";
  const page = `@top-right { content: "${orderId.replace(/[^\w-]/g, "")}"; ${text} } @bottom-right { content: "Page " counter(page) " of " counter(pages); ${text} }`;
  return <style>{`@page { ${page} }`}</style>;
}
