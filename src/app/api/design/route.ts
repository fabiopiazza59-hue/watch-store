import { designerStatus, designWatch } from "@/domain/designer";
import { designRequestSchema } from "@/domain/schemas";
import { internalError, parseBody } from "../_lib/http";

export const runtime = "nodejs";
/** Seconds. A Claude design conversation can take several tool-use rounds. */
export const maxDuration = 300;

/** Which designer answers ("claude" or "offline") and with which model. */
export function GET() {
  return Response.json(designerStatus());
}

/** Turns a customer's message into a design, checked by the rules engine. */
export async function POST(request: Request) {
  const body = await parseBody(request, designRequestSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json(await designWatch(body.data));
  } catch (error) {
    return internalError("POST /api/design", error);
  }
}
