import { OrderInputError, UnbuildableSpecError, type OrderInputField } from "@/server/orders";
import { internalError, jsonError } from "./http";

/** Where each order field lives in the request body, so field errors line up with the input. */
const FIELD_PATHS: Record<OrderInputField, string> = {
  name: "customer.name",
  email: "customer.email",
  notes: "notes",
  status: "status",
};

/** Maps the order store's errors to responses: 400 for bad input, 422 for unbuildable designs. */
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
  return internalError(route, error);
}
