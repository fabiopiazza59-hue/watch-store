import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildSheetView } from "@/components/orders/BuildSheetView";
import { PrintButton } from "@/components/orders/PrintButton";
import { SpecSummary } from "@/components/orders/SpecSummary";
import { StatusSelector } from "@/components/orders/StatusSelector";
import { WatchPreview } from "@/components/preview/WatchPreview";
import { QuoteBreakdown } from "@/components/quote/QuoteBreakdown";
import { formatDateTime, formatPrice, plural } from "@/components/ui/format";
import { CheckIcon } from "@/components/ui/icons";
import { cardClass, eyebrowClass } from "@/components/ui/styles";
import { resolveSpec } from "@/domain/catalog";
import type { Order } from "@/domain/types";
import { getOrder } from "@/server/orders";

interface OrderPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Pick<OrderPageProps, "params">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id}` };
}

export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = await getOrder(id);
  if (!order) notFound();
  const designName = order.spec.name.trim() || "Untitled design";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 lg:pt-10 print:max-w-none print:p-0">
      <Link
        href="/orders"
        className="text-sm text-ink-faint underline decoration-line-strong underline-offset-4 hover:text-ink print:hidden"
      >
        &larr; Workshop queue
      </Link>

      {query.placed === "1" && <ThankYou order={order} />}

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
            <a href={`mailto:${order.customer.email}`} className="underline decoration-line-strong underline-offset-4 hover:text-ink">
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="The watch" className={`${cardClass} p-5 sm:p-6`}>
          <div className="mx-auto aspect-square w-full max-w-[360px] overflow-hidden print:max-w-[200px]">
            <WatchPreview
              parts={resolveSpec(order.spec)}
              personalization={order.spec.personalization}
              size={360}
              className="h-auto w-full max-w-full"
            />
          </div>
          <h2 className="mt-5 font-display text-xl font-semibold text-ink">Specification</h2>
          <div className="mt-2">
            <SpecSummary spec={order.spec} />
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
                  {formatPrice(order.quote.suggestedRetailEur)}
                </span>
                <span className="ml-2 text-sm text-ink-faint">excl. VAT</span>
              </p>
              <p className="text-sm text-ink-soft">
                Lead time about <strong className="font-semibold text-ink">{plural(order.quote.leadTimeDays, "day")}</strong>
              </p>
            </div>
            <div className="mt-3 border-t border-line">
              <QuoteBreakdown quote={order.quote} />
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
        <BuildSheetView sheet={order.buildSheet} />
      </div>
    </div>
  );
}

function ThankYou({ order }: { order: Order }) {
  const firstName = order.customer.name.trim().split(/\s+/)[0];
  return (
    <div role="status" className="mt-6 flex items-start gap-4 rounded-xl border border-ok/25 bg-ok-soft p-5 print:hidden">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ok text-paper">
        <CheckIcon className="size-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-semibold text-ink">Thank you{firstName ? `, ${firstName}` : ""}.</p>
        <p className="mt-1 leading-relaxed text-ink-soft">
          Your order is in the workshop queue. We&rsquo;ll email {order.customer.email} to confirm the details before we
          order any parts. From then on it takes about {plural(order.quote.leadTimeDays, "day")} to source, assemble,
          regulate and test.
        </p>
      </div>
    </div>
  );
}
