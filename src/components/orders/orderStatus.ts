import type { OrderStatus } from "@/domain/types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Received",
  "parts-ordered": "Parts ordered",
  assembling: "On the bench",
  qc: "Quality check",
  shipped: "Shipped",
  cancelled: "Cancelled",
};

export { isOrderStatus, ORDER_STATUSES } from "@/domain/orderStatus";

/** Orders still moving through the workshop. */
export function isOpen(status: OrderStatus): boolean {
  return status !== "shipped" && status !== "cancelled";
}
