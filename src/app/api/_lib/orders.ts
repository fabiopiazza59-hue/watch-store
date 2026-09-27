import {
  CorruptOrderError,
  OrderCapacityError,
  OrderInputError,
  UnbuildableSpecError,
  type OrderInputField,
} from "@/server/orders";
import { internalError, jsonError } from "./http";

/** Where each order field lives in the request body, so field errors line up with the input. */
const FIELD_PATHS: Record<OrderInputField, string> = {
  name: "customer.name",
  email: "customer.email",
  notes: "notes",
  status: "status",
};

/**
 * Maps the order store's errors to responses: 400 for bad input, 422 for unbuildable designs, 503
 * when the day's orders are full, and 500 naming the file when a stored order is damaged.
 */
export function orderErrorResponse(route: string, error: unknown): Response {
  if (error instanceof OrderInputError) {
    const fields = Object.fromEntries(
      (Object.entries(error.fieldErrors) as [OrderInputField, string][]).map(([field, message]) => [FIELD_PATHS[field], message]),
    );
    return jsonError(400, "Please check the highlighted fields.", { fields });
  }
  if (error instanceof UnbuildableSpecError) {
    return jsonError(422, "This design can't be built as it stands. See the report for what needs to change.", {
      report: error.report,
    });
  }
  if (error instanceof OrderCapacityError) {
    return jsonError(503, "We're not taking more orders today. Please try again tomorrow.");
  }
  if (error instanceof CorruptOrderError) {
    console.error(`[api] ${route}:`, error.message);
    return jsonError(500, `The order file ${error.orderId}.json is damaged; fix or restore it.`);
  }
  return internalError(route, error);
}

/** The answer to a workshop-only request that doesn't carry the workshop token. */
export function workshopOnly(): Response {
  return jsonError(401, "Only the workshop can see or change orders. Sign in to the workshop first.");
}
