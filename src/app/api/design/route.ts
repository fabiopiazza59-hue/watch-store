import { designerStatus, designWatch } from "@/domain/designer";
import { designRequestSchema, REQUEST_BODY_LIMITS } from "@/domain/schemas";
import { internalError, jsonError, parseBody } from "../_lib/http";
import { clientKey, concurrencyLimit, dailyQuota, envLimit, fixedWindowLimiter, tooManyRequests } from "../_lib/limits";

export const runtime = "nodejs";
/** Seconds. A little over the Claude designer's own deadline, after which it answers offline. */
export const maxDuration = 120;

// Every Claude conversation costs money, so it is rationed; the offline designer is not.
const perClient = fixedWindowLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });
const inFlight = concurrencyLimit(4);
/** Optional spend cap: past DESIGN_DAILY_LIMIT Claude conversations a day, the offline designer answers. */
const claudeToday = dailyQuota(() => envLimit("DESIGN_DAILY_LIMIT"));

/** Which designer answers ("claude" or "offline") and with which model. */
export function GET() {
  return Response.json(designerStatus());
}

/** Turns a customer's message into a design, checked by the rules engine. */
export async function POST(request: Request) {
  const body = await parseBody(request, designRequestSchema, { maxBytes: REQUEST_BODY_LIMITS.design });
  if (!body.ok) return body.response;
  if (designerStatus().mode === "offline") return design(() => designWatch(body.data));

  const allowed = perClient.take(clientKey(request));
  if (!allowed.ok) {
    return tooManyRequests(
      allowed.retryAfterSeconds,
      "You've sent the designer a lot of messages in a short time. Please wait a few minutes and try again.",
    );
  }
  const release = inFlight.tryAcquire();
  if (!release) {
    return jsonError(503, "The designer is busy right now. Please try again in a minute.", {}, { "Retry-After": "30" });
  }
  try {
    // The request's signal aborts when the customer goes away, which ends the conversation early.
    return await design(() => designWatch(body.data, { signal: request.signal, claude: claudeToday.tryTake() }));
  } finally {
    release();
  }
}

async function design(run: () => ReturnType<typeof designWatch>): Promise<Response> {
  try {
    return Response.json(await run());
  } catch (error) {
    return internalError("POST /api/design", error);
  }
}
