// Server-only: persists orders as one JSON file each under ORDERS_DIR (default ./data/orders).
// Uses Node's filesystem, so never import it from client components.
import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBuildSheet } from "@/domain/buildSheet";
import { priceSpec } from "@/domain/pricing";
import { validateSpec } from "@/domain/rules";
import { isOrderStatus, ORDER_STATUSES } from "@/domain/orderStatus";
import type { Customer, Order, OrderStatus, ValidationReport, WatchSpec } from "@/domain/types";

export interface CreateOrderInput {
  spec: WatchSpec;
  customer: Customer;
  notes?: string;
}

export { ORDER_STATUSES };

export const ORDER_LIMITS = { nameMaxLength: 100, emailMaxLength: 254, notesMaxLength: 1000 } as const;

export type OrderInputField = "name" | "email" | "notes" | "status";

/** The customer's input can't be accepted; `fieldErrors` says why, per field. */
export class OrderInputError extends Error {
  constructor(readonly fieldErrors: Partial<Record<OrderInputField, string>>) {
    super(`Invalid order input: ${Object.values(fieldErrors).join(" ")}`);
    this.name = "OrderInputError";
  }
}

/** The design can't be assembled; `report` holds the rules engine's verdict. */
export class UnbuildableSpecError extends Error {
  constructor(readonly report: ValidationReport) {
    super("This design can't be built as specified.");
    this.name = "UnbuildableSpecError";
  }
}

const ORDER_ID = /^ORD-\d{8}-[0-9A-F]{4}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The directory is only known at run time (ORDERS_DIR), so the bundler is told not to trace it:
 * otherwise Turbopack would copy the whole project into the server output to be safe.
 */
function ordersDir(): string {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.ORDERS_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "orders"),
  );
}

/** Only ever called with ids that passed ORDER_ID, so the path can't leave the orders directory. */
function orderPath(id: string): string {
  return path.join(ordersDir(), `${id}.json`);
}

function newOrderId(now: Date): string {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();
  return `ORD-${day}-${suffix}`;
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}

/** Write via a temp file and rename, so readers never see a half-written order. */
async function writeOrder(order: Order): Promise<void> {
  await mkdir(ordersDir(), { recursive: true });
  const target = orderPath(order.id);
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(order, null, 2)}\n`, "utf8");
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

function isOrder(value: unknown, id: string): value is Order {
  if (typeof value !== "object" || value === null) return false;
  const order = value as Partial<Order>;
  return (
    order.id === id &&
    typeof order.createdAt === "string" &&
    isOrderStatus(order.status) &&
    typeof order.customer === "object" &&
    typeof order.spec === "object" &&
    typeof order.quote === "object" &&
    typeof order.buildSheet === "object"
  );
}

async function readOrder(id: string): Promise<Order | null> {
  let raw: string;
  try {
    raw = await readFile(orderPath(id), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!isOrder(parsed, id)) throw new Error(`Order file ${id}.json is not a valid order`);
  return parsed;
}

function validateInput(input: CreateOrderInput): { customer: Customer; notes: string } {
  const name = typeof input.customer?.name === "string" ? input.customer.name.trim() : "";
  const email = typeof input.customer?.email === "string" ? input.customer.email.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const errors: Partial<Record<OrderInputField, string>> = {};

  if (!name) errors.name = "Please tell us your name.";
  else if (name.length > ORDER_LIMITS.nameMaxLength)
    errors.name = `Please keep your name to ${ORDER_LIMITS.nameMaxLength} characters.`;

  if (!email) errors.email = "Please give an email address so we can reach you about your watch.";
  else if (email.length > ORDER_LIMITS.emailMaxLength || !EMAIL.test(email))
    errors.email = "That email address doesn't look right.";

  if (input.notes !== undefined && typeof input.notes !== "string") errors.notes = "Notes must be text.";
  else if (notes.length > ORDER_LIMITS.notesMaxLength)
    errors.notes = `Please keep notes to ${ORDER_LIMITS.notesMaxLength} characters.`;

  if (Object.keys(errors).length > 0) throw new OrderInputError(errors);
  return { customer: { name, email }, notes };
}

/** Validates the spec (rejects unbuildable specs), prices it, builds the build sheet, persists it. */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { customer, notes } = validateInput(input);
  const report = validateSpec(input.spec);
  if (!report.buildable) throw new UnbuildableSpecError(report);

  const now = new Date();
  let id = newOrderId(now);
  while (await exists(orderPath(id))) id = newOrderId(now);

  const order: Order = {
    id,
    createdAt: now.toISOString(),
    status: "received",
    customer,
    notes,
    spec: input.spec,
    quote: priceSpec(input.spec),
    buildSheet: createBuildSheet(input.spec),
  };
  await writeOrder(order);
  return order;
}

/** All orders, newest first. Unreadable or corrupt files are skipped (and logged), never fatal. */
export async function listOrders(): Promise<Order[]> {
  let files: string[];
  try {
    files = await readdir(ordersDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const ids = files.filter((file) => file.endsWith(".json")).map((file) => file.slice(0, -".json".length));
  const orders = await Promise.all(
    ids
      .filter((id) => ORDER_ID.test(id))
      .map((id) =>
        readOrder(id).catch((error: unknown) => {
          console.warn(`Skipping unreadable order file ${id}.json:`, error);
          return null;
        }),
      ),
  );
  return orders
    .filter((order): order is Order => order !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/** The order with this id, or null when there is none. Malformed ids never reach the filesystem. */
export async function getOrder(id: string): Promise<Order | null> {
  if (typeof id !== "string" || !ORDER_ID.test(id)) return null;
  return readOrder(id);
}

/** Moves an order to a new status. Returns null when there is no such order. */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
  if (!isOrderStatus(status)) {
    throw new OrderInputError({ status: `Unknown status. Use one of: ${ORDER_STATUSES.join(", ")}.` });
  }
  const order = await getOrder(id);
  if (!order) return null;
  const updated: Order = { ...order, status };
  await writeOrder(updated);
  return updated;
}
