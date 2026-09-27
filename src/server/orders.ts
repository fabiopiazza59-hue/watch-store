// Server-only: persists orders as one JSON file each under ORDERS_DIR (default ./data/orders).
// Uses Node's filesystem, so never import it from client components.
import { randomBytes, randomUUID } from "node:crypto";
import { link, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createBuildSheet } from "@/domain/buildSheet";
import { resolveExtras, resolveSpec, specExtras } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { normalizePersonalization, validateSpec } from "@/domain/rules";
import { isOrderStatus, ORDER_STATUSES } from "@/domain/orderStatus";
import { ORDER_LIMITS, ORDER_MESSAGES, orderSchema } from "@/domain/schemas";
import type { Customer, Order, OrderStatus, ResolvedExtras, ValidationReport, WatchSpec } from "@/domain/types";

export interface CreateOrderInput {
  spec: WatchSpec;
  customer: Customer;
  notes?: string;
}

export { ORDER_LIMITS, ORDER_STATUSES };

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

/** An order file exists but isn't a readable order (bad JSON, missing or mistyped fields). */
export class CorruptOrderError extends Error {
  constructor(
    readonly orderId: string,
    readonly problem: string,
  ) {
    super(`Order file ${orderId}.json is damaged: ${problem}`);
    this.name = "CorruptOrderError";
  }
}

/** The workshop has taken as many orders today as it is set up to accept (ORDERS_DAILY_LIMIT). */
export class OrderCapacityError extends Error {
  constructor(readonly limit: number) {
    super(`The daily limit of ${limit} orders has been reached.`);
    this.name = "OrderCapacityError";
  }
}

/**
 * `ORD-` + the UTC day + 16 hex digits (64 random bits), so ids can't be guessed or run out.
 * Orders placed before ids grew have 4 hex digits and still resolve.
 */
const ORDER_ID = /^ORD-\d{8}-(?:[0-9A-F]{4}|[0-9A-F]{16})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/**
 * Characters no real address needs that could change what a mailto: link does (extra recipients,
 * a prefilled body) or break out of markup. The order page encodes the address too.
 */
const EMAIL_FORBIDDEN = /[?#&/\\"<>,;:%]/;

/** Orders a list shows at most at once; older ones are a page away. */
export const ORDER_PAGE_SIZE = 100;
const DEFAULT_DAILY_ORDER_LIMIT = 200;
/** A random id is taken this rarely that a few fresh draws always find a free one. */
const MAX_ID_ATTEMPTS = 5;

export function isOrderId(value: unknown): value is string {
  return typeof value === "string" && ORDER_ID.test(value);
}

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

function dayStamp(now: Date): string {
  return now.toISOString().slice(0, 10).replaceAll("-", "");
}

function newOrderId(now: Date): string {
  return `ORD-${dayStamp(now)}-${randomBytes(8).toString("hex").toUpperCase()}`;
}

function serialize(order: Order): string {
  return `${JSON.stringify(order, null, 2)}\n`;
}

/**
 * Writes a new order under its id, failing with EEXIST if that id is taken. The file is written
 * in full under a temporary name, then hard-linked into place: a link, unlike a rename, never
 * replaces an existing file, and readers never see a half-written order.
 */
async function createOrderFile(order: Order): Promise<void> {
  await mkdir(ordersDir(), { recursive: true });
  const target = orderPath(order.id);
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, serialize(order), "utf8");
    await link(temp, target);
  } finally {
    await rm(temp, { force: true });
  }
}

/** Replaces an existing order, via a temp file and rename so readers never see a half-written one. */
async function replaceOrderFile(order: Order): Promise<void> {
  const target = orderPath(order.id);
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, serialize(order), "utf8");
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

async function readOrder(id: string): Promise<Order | null> {
  let raw: string;
  try {
    raw = await readFile(orderPath(id), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CorruptOrderError(id, "it isn't valid JSON");
  }
  const result = orderSchema.safeParse(parsed);
  if (!result.success) throw new CorruptOrderError(id, z.prettifyError(result.error));
  if (result.data.id !== id) throw new CorruptOrderError(id, `it holds order ${result.data.id}`);
  return result.data;
}

/** Ids of every order file, newest day first. Within a day the order follows the random suffix. */
async function orderIds(): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(ordersDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .filter(isOrderId)
    .sort()
    .reverse();
}

function dailyOrderLimit(): number {
  const configured = Number(process.env.ORDERS_DAILY_LIMIT?.trim() || NaN);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_ORDER_LIMIT;
}

/** Counted from the order files themselves, so the cap survives restarts. */
async function ensureCapacity(now: Date): Promise<void> {
  const limit = dailyOrderLimit();
  const prefix = `ORD-${dayStamp(now)}-`;
  const placedToday = (await orderIds()).filter((id) => id.startsWith(prefix)).length;
  if (placedToday >= limit) throw new OrderCapacityError(limit);
}

function validateInput(input: CreateOrderInput): { customer: Customer; notes: string } {
  const name = typeof input.customer?.name === "string" ? input.customer.name.trim() : "";
  const email = typeof input.customer?.email === "string" ? input.customer.email.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const errors: Partial<Record<OrderInputField, string>> = {};

  if (!name) errors.name = "Please tell us your name.";
  else if (name.length > ORDER_LIMITS.nameMaxLength) errors.name = ORDER_MESSAGES.nameTooLong;

  if (!email) errors.email = "Please give an email address so we can reach you about your watch.";
  else if (email.length > ORDER_LIMITS.emailMaxLength || !EMAIL.test(email) || EMAIL_FORBIDDEN.test(email)) {
    errors.email = ORDER_MESSAGES.badEmail;
  }

  if (input.notes !== undefined && typeof input.notes !== "string") errors.notes = "Notes must be text.";
  else if (notes.length > ORDER_LIMITS.notesMaxLength) errors.notes = ORDER_MESSAGES.notesTooLong;

  if (Object.keys(errors).length > 0) throw new OrderInputError(errors);
  return { customer: { name, email }, notes };
}

/** The extras as the catalogues describe them today, or undefined when the spec has none. */
function extrasSnapshot(spec: WatchSpec): ResolvedExtras | undefined {
  const { spareStrapId, itemIds } = specExtras(spec);
  if (!spareStrapId && itemIds.length === 0) return undefined;
  const { spareStrap, items } = resolveExtras(spec);
  return spareStrap ? { spareStrap, items } : { items };
}

/**
 * Validates the spec (rejects unbuildable specs), prices it, builds the build sheet and persists
 * it under a fresh id, with a copy of its parts and extras as the catalogues describe them today.
 * Typographic apostrophes and dashes in the personal texts are made plain first, whichever way the
 * spec came (configurator, share link, API). Throws OrderCapacityError once the day's order limit is
 * reached.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { customer, notes } = validateInput(input);
  const spec: WatchSpec = { ...input.spec, personalization: normalizePersonalization(input.spec.personalization) };
  const report = validateSpec(spec);
  if (!report.buildable) throw new UnbuildableSpecError(report);

  const now = new Date();
  await ensureCapacity(now);
  const extras = extrasSnapshot(spec);
  const details: Omit<Order, "id"> = {
    createdAt: now.toISOString(),
    status: "received",
    customer,
    notes,
    spec,
    parts: resolveSpec(spec),
    ...(extras ? { extras } : {}),
    quote: priceSpec(spec),
    buildSheet: createBuildSheet(spec),
  };
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const order: Order = { id: newOrderId(now), ...details };
    try {
      await createOrderFile(order);
      return order;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error(`Could not find an unused order id in ${MAX_ID_ATTEMPTS} attempts`);
}

export interface OrderListOptions {
  /** At most this many orders (1 to ORDER_PAGE_SIZE, the default). */
  limit?: number;
  /** Only orders listed after this id: the previous page's `nextBefore`. */
  before?: string;
}

export interface OrderPage<T> {
  orders: T[];
  /** Pass as `before` for the next page; null when this is the last one. */
  nextBefore: string | null;
}

/** What a list of orders shows: no build sheet, spec or cost breakdown. */
export interface OrderSummary {
  id: string;
  createdAt: string;
  status: OrderStatus;
  /** As the customer named it; may be blank. */
  designName: string;
  customer: Customer;
  /** What the customer pays, VAT included. */
  retailInclVatEur: number;
}

/**
 * One page of orders, newest first. Only that page's files are read, so the cost of a list doesn't
 * grow with the number of orders. Damaged files are skipped (and logged), never fatal.
 */
export async function listOrderPage({ limit = ORDER_PAGE_SIZE, before }: OrderListOptions = {}): Promise<OrderPage<Order>> {
  const size = Math.min(Math.max(Math.trunc(limit) || ORDER_PAGE_SIZE, 1), ORDER_PAGE_SIZE);
  const ids = (await orderIds()).filter((id) => before === undefined || id < before);
  const pageIds = ids.slice(0, size);
  const orders = await Promise.all(
    pageIds.map((id) =>
      readOrder(id).catch((error: unknown) => {
        console.warn(`Skipping unreadable order file ${id}.json:`, error);
        return null;
      }),
    ),
  );
  return {
    orders: orders
      .filter((order): order is Order => order !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
    nextBefore: ids.length > size ? pageIds[pageIds.length - 1] : null,
  };
}

export async function listOrderSummaries(options: OrderListOptions = {}): Promise<OrderPage<OrderSummary>> {
  const { orders, nextBefore } = await listOrderPage(options);
  return {
    orders: orders.map(({ id, createdAt, status, spec, customer, quote }) => ({
      id,
      createdAt,
      status,
      designName: spec.name,
      customer,
      retailInclVatEur: quote.retailInclVatEur,
    })),
    nextBefore,
  };
}

/**
 * The order with this id, or null when there is none. Malformed ids never reach the filesystem.
 * Throws CorruptOrderError when the file exists but is damaged.
 */
export async function getOrder(id: string): Promise<Order | null> {
  if (!isOrderId(id)) return null;
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
  await replaceOrderFile(updated);
  return updated;
}
