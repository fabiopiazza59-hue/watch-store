import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderConfirmation } from "@/components/orders/OrderConfirmation";
import { CorruptOrderError, getOrder } from "@/server/orders";
import { isOrderConfirmationToken } from "@/server/workshopAuth";

export const metadata: Metadata = { title: "Order placed", robots: { index: false, follow: false } };

interface OrderPlacedPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The customer's confirmation, where placing an order lands. The link carries a token signed for this
 * order (`?t=`) whenever the server has a link secret; without the right one it is simply not found.
 */
export default async function OrderPlacedPage({ params, searchParams }: OrderPlacedPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isOrderConfirmationToken(id, query.t)) notFound();
  const order = await getOrder(id).catch((error: unknown) => {
    // The workshop sees what's wrong with the file; the customer isn't shown someone else's problem.
    if (error instanceof CorruptOrderError) {
      console.error(error);
      return null;
    }
    throw error;
  });
  if (!order) notFound();
  return <OrderConfirmation order={order} />;
}
