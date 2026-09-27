// Browser-side calls to the app's API. Every failure becomes an ApiError whose message is safe to
// show a customer; the API's `{ error, fields?, report? }` details travel with it.
import type {
  ChatTurn,
  Customer,
  DesignResponse,
  Order,
  OrderStatus,
  ValidationReport,
  WatchSpec,
} from "@/domain/types";

export interface DesignerInfo {
  mode: DesignResponse["mode"];
  model: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Per-field messages keyed by request body path, e.g. "customer.email". */
    readonly fields: Record<string, string> = {},
    /** The rules engine's verdict, when a design was refused as unbuildable. */
    readonly report: ValidationReport | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const NETWORK_ERROR = "We couldn't reach the workshop's server. Check your connection and try again.";
const TIMEOUT_ERROR = "The designer is taking too long to answer. Please try again.";

/**
 * How long the chat waits for the designer. The server gives Claude 90 seconds and the route 120, so
 * past this something has gone wrong on the way, and the customer gets a message instead of a spinner.
 */
const DESIGN_TIMEOUT_MS = 130_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringFields(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function isReport(value: unknown): value is ValidationReport {
  return isRecord(value) && typeof value.buildable === "boolean" && Array.isArray(value.issues);
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const fallback = `Something went wrong (HTTP ${response.status}). Please try again.`;
  if (!isRecord(body)) return new ApiError(fallback, response.status);
  return new ApiError(
    typeof body.error === "string" ? body.error : fallback,
    response.status,
    stringFields(body.fields),
    isReport(body.report) ? body.report : null,
  );
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new ApiError(TIMEOUT_ERROR, 0);
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(NETWORK_ERROR, 0);
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

export function fetchDesignerInfo(signal?: AbortSignal): Promise<DesignerInfo> {
  return request<DesignerInfo>("/api/design", { signal });
}

export function requestDesign(input: {
  message: string;
  currentSpec: WatchSpec;
  history: ChatTurn[];
}): Promise<DesignResponse> {
  return request<DesignResponse>("/api/design", {
    method: "POST",
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(DESIGN_TIMEOUT_MS),
  });
}

/** A new order, with the `?t=` token of its customer confirmation link (null when none is needed). */
export interface PlacedOrder extends Order {
  confirmationToken: string | null;
}

export async function placeOrder(input: { spec: WatchSpec; customer: Customer; notes: string }): Promise<PlacedOrder> {
  const order = await request<Order & { confirmationToken?: unknown }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { ...order, confirmationToken: typeof order.confirmationToken === "string" ? order.confirmationToken : null };
}

export function changeOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return request<Order>(`/api/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
