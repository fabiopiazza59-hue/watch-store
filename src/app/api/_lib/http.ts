// Shared plumbing for the API route handlers: JSON errors in one shape, guarded body reading and
// validation, and a catch-all that logs the real error server-side but never sends it to the client.
import type { z } from "zod";

/**
 * Every error response has the same shape: `{ error, ...extra }`, where `error` is a message fit to
 * show a customer and `extra` may add `fields` (per-field messages keyed by body path) or a `report`.
 */
export function jsonError(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
  headers?: HeadersInit,
): Response {
  return Response.json({ error, ...extra }, { status, headers });
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

const BAD_JSON = "The request body must be valid JSON.";
const TOO_LARGE = "The request is too large.";

/**
 * A page on another site can make a visitor's browser send simple requests here (a form, or fetch
 * in no-cors mode) without asking first. Browsers label those `Sec-Fetch-Site: cross-site`; when a
 * public origin is configured, any other declared Origin is refused too. Clients that send neither
 * header (curl, older browsers) are let through: this guards visitors' browsers, not the API.
 */
export function rejectCrossSite(request: Request): Response | null {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonError(403, "Requests from other websites aren't accepted.");
  }
  const origin = request.headers.get("origin");
  const publicOrigin = configuredPublicOrigin();
  if (origin && publicOrigin && origin !== publicOrigin) {
    return jsonError(403, "Requests from other websites aren't accepted.");
  }
  return null;
}

function configuredPublicOrigin(): string | null {
  const value = process.env.PUBLIC_ORIGIN?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Only `application/json` bodies are read. Browsers can't send that type across sites without a
 * CORS preflight, which this app never approves. The media type is compared exactly: a value such
 * as `text/plain; x=application/json` is still one a browser sends without asking.
 */
function isJsonContentType(request: Request): boolean {
  const essence = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  return essence === "application/json";
}

/**
 * Reads the body as UTF-8 text, refusing it once it passes `maxBytes`: a declared Content-Length is
 * checked before anything is read, and a streamed body is counted as it arrives, so nothing larger
 * than the limit is ever held in memory.
 */
async function readText(request: Request, maxBytes: number): Promise<{ ok: true; text: string } | { ok: false; response: Response }> {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    return { ok: false, response: jsonError(413, TOO_LARGE) };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, response: jsonError(400, BAD_JSON) };

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, response: jsonError(413, TOO_LARGE) };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, response: jsonError(400, BAD_JSON) };
  }
}

export interface BodyLimits {
  /** Largest body accepted, in bytes; larger ones get a 413 without being read in full. */
  maxBytes: number;
}

/**
 * Guards, reads and validates a JSON request body; every POST and PATCH handler goes through here.
 * On failure, `response` is the error to return: 403 for a cross-site browser request, 415 for a
 * body that isn't JSON, 413 for one over the limit, 400 for malformed or invalid JSON.
 */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  { maxBytes }: BodyLimits,
): Promise<ParsedBody<z.output<S>>> {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return { ok: false, response: crossSite };
  if (!isJsonContentType(request)) {
    return { ok: false, response: jsonError(415, "Send the request body as JSON (Content-Type: application/json).") };
  }

  const read = await readText(request, maxBytes);
  if (!read.ok) return read;
  let body: unknown;
  try {
    body = JSON.parse(read.text);
  } catch {
    return { ok: false, response: jsonError(400, BAD_JSON) };
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
