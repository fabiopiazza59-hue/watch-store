// CONTRACT STUB — implemented by the pricing/build-sheet/orders build step. Keep these signatures.
// Server-only: persists orders as JSON files under ORDERS_DIR (default: ./data/orders).
import type { Customer, Order, OrderStatus, WatchSpec } from "@/domain/types";

export interface CreateOrderInput {
  spec: WatchSpec;
  customer: Customer;
  notes?: string;
}

/** Validates the spec (rejects unbuildable specs), prices it, builds the build sheet, persists it. */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  void input;
  throw new Error("createOrder: not implemented");
}

export async function listOrders(): Promise<Order[]> {
  throw new Error("listOrders: not implemented");
}

export async function getOrder(id: string): Promise<Order | null> {
  void id;
  throw new Error("getOrder: not implemented");
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
  void id; void status;
  throw new Error("updateOrderStatus: not implemented");
}
