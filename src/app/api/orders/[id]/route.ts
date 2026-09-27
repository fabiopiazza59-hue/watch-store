import { REQUEST_BODY_LIMITS, updateOrderStatusRequestSchema } from "@/domain/schemas";
import { getOrder, updateOrderStatus } from "@/server/orders";
import { isWorkshopRequest } from "@/server/workshopAuth";
import { jsonError, parseBody } from "../../_lib/http";
import { orderErrorResponse, workshopOnly } from "../../_lib/orders";

export const runtime = "nodejs";

interface OrderRouteContext {
  params: Promise<{ id: string }>;
}

const NOT_FOUND = "There's no order with that id.";

/** The full order, build sheet included (workshop only). */
export async function GET(request: Request, { params }: OrderRouteContext) {
  if (!isWorkshopRequest(request.headers)) return workshopOnly();
  const { id } = await params;
  try {
    const order = await getOrder(id);
    return order ? Response.json(order) : jsonError(404, NOT_FOUND);
  } catch (error) {
    return orderErrorResponse("GET /api/orders/[id]", error);
  }
}

/** Moves an order along the workshop's workflow (workshop only). */
export async function PATCH(request: Request, { params }: OrderRouteContext) {
  if (!isWorkshopRequest(request.headers)) return workshopOnly();
  const { id } = await params;
  const body = await parseBody(request, updateOrderStatusRequestSchema, { maxBytes: REQUEST_BODY_LIMITS.orderStatus });
  if (!body.ok) return body.response;
  try {
    const order = await updateOrderStatus(id, body.data.status);
    return order ? Response.json(order) : jsonError(404, NOT_FOUND);
  } catch (error) {
    return orderErrorResponse("PATCH /api/orders/[id]", error);
  }
}
