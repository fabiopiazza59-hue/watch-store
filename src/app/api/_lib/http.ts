// Shared plumbing for the API route handlers: JSON errors in one shape, body validation, and a
// catch-all that logs the real error server-side but never sends it to the client.
import type { z } from "zod";

/**
 * Every error response has the same shape: `{ error, ...extra }`, where `error` is a message fit to
 * show a customer and `extra` may add `fields` (per-field messages keyed by body path) or a `report`.
 */
export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status });
}

/** First message per field path: { "customer.email": "Invalid input: expected string, received number" }. */
function fieldMessages(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".") || "body";
    fields[path] ??= issue.message;
  }
  return fields;
}

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Reads and validates a JSON body; on failure, `response` is the 400 to return. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<ParsedBody<z.output<S>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError(400, "The request body must be valid JSON.") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(400, "Some fields are missing or invalid.", { fields: fieldMessages(result.error) }),
    };
  }
  return { ok: true, data: result.data };
}

export function internalError(route: string, error: unknown): Response {
  console.error(`[api] ${route} failed:`, error);
  return jsonError(500, "Something went wrong on our side. Please try again.");
}
