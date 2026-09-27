import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { isOpen } from "@/components/orders/orderStatus";
import { StatusPill } from "@/components/orders/StatusPill";
import { formatDateTime, formatPrice, plural } from "@/components/ui/format";
import { buttonClass, cardClass, eyebrowClass } from "@/components/ui/styles";
import { WrenchIcon } from "@/components/ui/icons";
import type { Order } from "@/domain/types";
import { listOrders } from "@/server/orders";

export const metadata: Metadata = {
  title: "Workshop",
  description: "The workshop queue: every order placed, newest first, with its build sheet.",
};

function designName(order: Order): string {
  return order.spec.name.trim() || "Untitled design";
}

export default async function OrdersPage() {
  await connection();
  const orders = await listOrders();
  const open = orders.filter((order) => isOpen(order.status)).length;

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
        {orders.length > 0 && (
          <p className="text-sm text-ink-soft">
            {plural(orders.length, "order")} &middot; <strong className="font-semibold text-ink">{open} open</strong>
          </p>
        )}
      </header>

      {orders.length === 0 ? (
        <div className={`${cardClass} mt-8 flex flex-col items-center px-6 py-16 text-center`}>
          <span className="flex size-14 items-center justify-center rounded-full bg-brass-soft text-brass-ink">
            <WrenchIcon className="size-7" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-semibold text-ink">The bench is clear</h2>
          <p className="mt-2 max-w-md leading-relaxed text-ink-soft">
            Orders arrive here when a customer designs a watch the rules engine confirms we can build, and places
            it from the configurator. Each one comes with its own build sheet.
          </p>
          <Link href="/" className={`${buttonClass("primary", "md")} mt-6`}>
            Design a watch
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 flex flex-col gap-3 md:hidden">
            {orders.map((order) => (
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
                    {order.customer.name} &middot; {formatPrice(order.quote.suggestedRetailEur)}
                  </span>
                  <span className="font-mono text-xs text-ink-faint">
                    {order.id} &middot; {formatDateTime(order.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className={`${cardClass} mt-8 hidden overflow-hidden md:block`}>
            <table className="w-full text-sm">
              <caption className="sr-only">Orders, newest first</caption>
              <thead className="bg-surface-muted/60">
                <tr className="text-left text-xs tracking-[0.08em] text-ink-faint uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">Order</th>
                  <th scope="col" className="px-4 py-3 font-medium">Placed</th>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Design</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-surface-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-xs font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                      >
                        {order.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">{formatDateTime(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="text-ink">{order.customer.name}</span>
                      <span className="block text-xs text-ink-faint">{order.customer.email}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{designName(order)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-ink tabular-nums">
                      {formatPrice(order.quote.suggestedRetailEur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
