// How the workshop queue sorts out its orders: which tab each belongs to and when each is due.
import type { OrderStatus, PriceQuote } from "@/domain/types";
import { isOpen } from "./orderStatus";

export const QUEUE_FILTERS = ["open", "shipped", "cancelled", "all"] as const;
export type QueueFilter = (typeof QUEUE_FILTERS)[number];

export const QUEUE_FILTER_LABELS: Record<QueueFilter, string> = {
  open: "Open",
  shipped: "Shipped",
  cancelled: "Cancelled",
  all: "All",
};

/** The tab asked for in `?status=`; open orders unless it names another. */
export function queueFilter(value: unknown): QueueFilter {
  return QUEUE_FILTERS.find((filter) => filter === value) ?? "open";
}

export function inQueue(filter: QueueFilter, status: OrderStatus): boolean {
  if (filter === "all") return true;
  if (filter === "open") return isOpen(status);
  return status === filter;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** An open order due within this many days is flagged. */
const DUE_SOON_DAYS = 3;

interface Placed {
  createdAt: string;
  quote: Pick<PriceQuote, "leadTimeDays">;
}

/** When the order should ship: the day it was placed plus the lead time quoted then. */
export function dueDate(order: Placed): Date {
  return new Date(Date.parse(order.createdAt) + order.quote.leadTimeDays * DAY_MS);
}

/** "overdue" or "soon" for an open order that needs attention; null otherwise. */
export function dueUrgency(order: Placed & { status: OrderStatus }, now: Date): "overdue" | "soon" | null {
  if (!isOpen(order.status)) return null;
  const left = dueDate(order).getTime() - now.getTime();
  if (left < 0) return "overdue";
  return left < DUE_SOON_DAYS * DAY_MS ? "soon" : null;
}

/** The first line of the customer's notes, for a glance in the queue; null without notes. */
export function notesPreview(notes: string): string | null {
  return notes.trim().split("\n")[0]?.trim() || null;
}
