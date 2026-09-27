// The order workflow, as runtime values. Plain data with no Node APIs, so the browser (status
// pickers), the API schemas and the server-side order store all share this one list.
import type { OrderStatus } from "./types";

/** Order statuses in workflow order. */
export const ORDER_STATUSES = [
  "received",
  "parts-ordered",
  "assembling",
  "qc",
  "shipped",
  "cancelled",
] as const satisfies readonly OrderStatus[];

// Fails to compile if OrderStatus gains a value that the list above is missing.
type Missing = Exclude<OrderStatus, (typeof ORDER_STATUSES)[number]>;
const everyStatusListed: [Missing] extends [never] ? true : never = true;
void everyStatusListed;

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (ORDER_STATUSES as readonly unknown[]).includes(value);
}
