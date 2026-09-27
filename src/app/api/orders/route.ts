import { createOrderRequestSchema } from "@/domain/schemas";
import { createOrder, listOrders } from "@/server/orders";
import { internalError, parseBody } from "../_lib/http";
import { orderErrorResponse } from "../_lib/orders";

export const runtime = "nodejs";

/** Every order, newest first. */
export async function GET() {
  try {
    return Response.json(await listOrders());
  } catch (error) {
    return internalError("GET /api/orders", error);
  }
}

/** Places an order for a buildable design. */
export async function POST(request: Request) {
  const body = await parseBody(request, createOrderRequestSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json(await createOrder(body.data), { status: 201 });
  } catch (error) {
    return orderErrorResponse("POST /api/orders", error);
  }
}
