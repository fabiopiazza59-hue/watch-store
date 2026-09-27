import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { StatusPill } from "@/components/orders/StatusPill";
import { WorkshopSignIn } from "@/components/orders/WorkshopSignIn";
import {
  dueDate,
  dueUrgency,
  inQueue,
  notesPreview,
  QUEUE_FILTER_LABELS,
  QUEUE_FILTERS,
  type QueueFilter,
  queueFilter,
} from "@/components/orders/queue";
import { formatDate, formatDateTime, formatPrice } from "@/components/ui/format";
import { AlertIcon, WrenchIcon } from "@/components/ui/icons";
import { buttonClass, cardClass, eyebrowClass } from "@/components/ui/styles";
import type { Order } from "@/domain/types";
import { isOrderId, listOrderPage } from "@/server/orders";
import { workshopGateEnabled } from "@/server/workshopAuth";
import { signOutOfWorkshop } from "./actions";
import { canSeeWorkshop } from "./workshopGate";

export const metadata: Metadata = {
  title: "Workshop",
  description: "The workshop queue: every order placed, newest first, with its build sheet.",
  robots: { index: false, follow: false },
};

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function designName(order: Order): string {
  return order.spec.name.trim() || "Untitled design";
}

function queueHref(filter: QueueFilter, before?: string): string {
  const query = new URLSearchParams(filter === "open" ? {} : { status: filter });
  if (before) query.set("before", before);
  const text = query.toString();
  return text ? `/orders?${text}` : "/orders";
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await connection();
  if (!(await canSeeWorkshop())) return <WorkshopSignIn />;
  const query = await searchParams;
  const filter = queueFilter(query.status);
  const before = isOrderId(query.before) ? query.before : undefined;
  const { orders: page, nextBefore } = await listOrderPage({ before });
  const orders = page.filter((order) => inQueue(filter, order.status));
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className={eyebrowClass}>Workshop</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Order queue</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Every watch ordered from the configurator, newest first. Open one for its build sheet: parts to source,
            tools, assembly steps and the checks it must pass before it ships.
          </p>
        </div>
        {workshopGateEnabled() && (
          <form action={signOutOfWorkshop}>
            <button type="submit" className={buttonClass("ghost", "sm")}>
              Sign out
            </button>
          </form>
        )}
      </header>

      {!workshopGateEnabled() && (
        <p role="note" className="mt-6 flex gap-2 rounded-lg border border-warn/25 bg-warn-soft/60 p-3 text-sm text-ink">
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-warn" />
          <span>
            Anyone can open the workshop pages until <code className="font-mono text-xs">WORKSHOP_TOKEN</code> is set on
            the server. Set it before customers use the site.
          </span>
        </p>
      )}

      <nav aria-label="Filter orders" className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {QUEUE_FILTERS.map((option) => {
            const count = page.filter((order) => inQueue(option, order.status)).length;
            const active = option === filter;
            return (
              <li key={option}>
                <Link
                  href={queueHref(option)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2.5 text-sm transition-colors sm:py-1.5 ${
                    active ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-soft hover:border-ink/40 hover:text-ink"
                  }`}
                >
                  {QUEUE_FILTER_LABELS[option]}
                  <span className="tabular-nums opacity-75">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <EmptyQueue filter={filter} anyOrders={page.length > 0} />
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-3 md:hidden">
            {orders.map((order) => {
              const notes = notesPreview(order.notes);
              return (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.id}`}
                    className={`${cardClass} flex flex-col gap-2 p-4 transition-colors hover:border-line-strong`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-display text-lg font-semibold text-ink">{designName(order)}</span>
                      <StatusPill status={order.status} />
                    </span>
                    <span className="text-sm text-ink-soft">
                      {order.customer.name} &middot; {formatPrice(order.quote.retailInclVatEur)}
                    </span>
                    <DueDate order={order} now={now} prefix="Due " />
                    {notes && <NotesPreview notes={notes} />}
                    <span className="font-mono text-xs text-ink-faint">
                      {order.id} &middot; {formatDateTime(order.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className={`${cardClass} mt-6 hidden overflow-hidden md:block`}>
            <table className="w-full text-sm">
              <caption className="sr-only">
                {QUEUE_FILTER_LABELS[filter]} orders, newest first
              </caption>
              <thead className="bg-surface-muted/60">
                <tr className="text-left text-xs tracking-[0.08em] text-ink-faint uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">Design</th>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Placed</th>
                  <th scope="col" className="px-4 py-3 font-medium">Due</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => {
                  const notes = notesPreview(order.notes);
                  return (
                    // The design name's link covers the whole row.
                    <tr key={order.id} className="relative transition-colors hover:bg-surface-muted/50">
                      <td className="max-w-72 px-4 py-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-medium text-ink underline decoration-line-strong underline-offset-4 after:absolute after:inset-0 hover:decoration-ink"
                        >
                          {designName(order)}
                        </Link>
                        <span className="mt-0.5 block font-mono text-xs text-ink-faint">{order.id}</span>
                        {notes && <NotesPreview notes={notes} />}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-ink">{order.customer.name}</span>
                        <span className="block text-xs text-ink-faint">{order.customer.email}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatDateTime(order.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <DueDate order={order} now={now} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-ink tabular-nums">
                        {formatPrice(order.quote.retailInclVatEur)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {nextBefore && (
        <p className="mt-6 text-right">
          <Link href={queueHref(filter, nextBefore)} className={buttonClass("secondary", "sm")}>
            Older orders &rarr;
          </Link>
        </p>
      )}
    </div>
  );
}

/** When the order should ship, in red once it is close or late. */
function DueDate({ order, now, prefix = "" }: { order: Order; now: Date; prefix?: string }) {
  const urgency = dueUrgency(order, now);
  return (
    <span className={`text-sm ${urgency ? "font-medium text-danger" : "text-ink-soft"}`}>
      {urgency && <AlertIcon className="mr-1 inline size-3.5 align-[-2px]" />}
      {urgency === "overdue" ? "Overdue since " : prefix}
      {formatDate(dueDate(order))}
    </span>
  );
}

/** The first line of the customer's notes, which often carries a deadline. */
function NotesPreview({ notes }: { notes: string }) {
  return (
    <span className="mt-1 block truncate text-xs text-warn" title={notes}>
      <span className="font-medium">Note:</span> {notes}
    </span>
  );
}

function EmptyQueue({ filter, anyOrders }: { filter: QueueFilter; anyOrders: boolean }) {
  if (anyOrders) {
    return (
      <p className={`${cardClass} mt-6 px-6 py-10 text-center text-ink-soft`}>
        No {QUEUE_FILTER_LABELS[filter].toLowerCase()} orders.{" "}
        <Link href={queueHref("all")} className="underline decoration-line-strong underline-offset-4 hover:text-ink">
          See all orders
        </Link>
      </p>
    );
  }
  return (
    <div className={`${cardClass} mt-6 flex flex-col items-center px-6 py-16 text-center`}>
      <span className="flex size-14 items-center justify-center rounded-full bg-brass-soft text-brass-ink">
        <WrenchIcon className="size-7" />
      </span>
      <h2 className="mt-4 font-display text-2xl font-semibold text-ink">The bench is clear</h2>
      <p className="mt-2 max-w-md leading-relaxed text-ink-soft">
        Orders arrive here when a customer designs a watch the rules engine confirms we can build, and places it from
        the configurator. Each one comes with its own build sheet.
      </p>
      <Link href="/" className={`${buttonClass("primary", "md")} mt-6`}>
        Design a watch
      </Link>
    </div>
  );
}
