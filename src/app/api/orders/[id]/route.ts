import { updateOrderStatusRequestSchema } from "@/domain/schemas";
import { getOrder, updateOrderStatus } from "@/server/orders";
import { internalError, jsonError, parseBody } from "../../_lib/http";
import { orderErrorResponse } from "../../_lib/orders";

export const runtime = "nodejs";

interface OrderRouteContext {
  params: Promise<{ id: string }>;
}

const NOT_FOUND = "There's no order with that id.";

export async function GET(_request: Request, { params }: OrderRouteContext) {
  const { id } = await params;
  try {
    const order = await getOrder(id);
    return order ? Response.json(order) : jsonError(404, NOT_FOUND);
  } catch (error) {
    return internalError("GET /api/orders/[id]", error);
  }
}

/** Moves an order along the workshop's workflow. */
export async function PATCH(request: Request, { params }: OrderRouteContext) {
  const { id } = await params;
  const body = await parseBody(request, updateOrderStatusRequestSchema);
  if (!body.ok) return body.response;
  try {
    const order = await updateOrderStatus(id, body.data.status);
    return order ? Response.json(order) : jsonError(404, NOT_FOUND);
  } catch (error) {
    return orderErrorResponse("PATCH /api/orders/[id]", error);
  }
}
