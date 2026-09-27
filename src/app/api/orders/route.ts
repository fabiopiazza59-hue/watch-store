import { z } from "zod";
import { createOrderRequestSchema, REQUEST_BODY_LIMITS } from "@/domain/schemas";
import { createOrder, isOrderId, listOrderSummaries, ORDER_PAGE_SIZE } from "@/server/orders";
import { isWorkshopRequest, orderConfirmationToken } from "@/server/workshopAuth";
import { internalError, jsonError, parseBody } from "../_lib/http";
import { clientKey, fixedWindowLimiter, tooManyRequests } from "../_lib/limits";
import { orderErrorResponse, workshopOnly } from "../_lib/orders";

export const runtime = "nodejs";

/** Orders a customer (or a script) can place per hour; failed attempts don't count. */
const perClient = fixedWindowLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(ORDER_PAGE_SIZE).optional(),
  before: z.string().refine(isOrderId, "Expected an order id.").optional(),
});

/**
 * One page of order summaries, newest first (workshop only): `{ orders, nextBefore }`. Pass
 * `?before=<nextBefore>` for older orders, and `?limit=` for smaller pages.
 */
export async function GET(request: Request) {
  if (!isWorkshopRequest(request.headers)) return workshopOnly();
  const query = listQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return jsonError(400, "The page of orders asked for isn't valid.");
  try {
    return Response.json(await listOrderSummaries(query.data));
  } catch (error) {
    return internalError("GET /api/orders", error);
  }
}

/**
 * Places an order for a buildable design. The response is the order plus `confirmationToken`, the
 * `?t=` value of the customer's confirmation link (null when no link secret is configured).
 */
export async function POST(request: Request) {
  const body = await parseBody(request, createOrderRequestSchema, { maxBytes: REQUEST_BODY_LIMITS.order });
  if (!body.ok) return body.response;
  const allowed = perClient.take(clientKey(request));
  if (!allowed.ok) {
    return tooManyRequests(
      allowed.retryAfterSeconds,
      "You've placed several orders in a short time. Please try again later, or email us to order more.",
    );
  }
  try {
    const order = await createOrder(body.data);
    return Response.json({ ...order, confirmationToken: orderConfirmationToken(order.id) }, { status: 201 });
  } catch (error) {
    allowed.refund();
    return orderErrorResponse("POST /api/orders", error);
  }
}
