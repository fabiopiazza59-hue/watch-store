import { priceSpec } from "@/domain/pricing";
import { validateSpec } from "@/domain/rules";
import { validateRequestSchema } from "@/domain/schemas";
import { internalError, parseBody } from "../_lib/http";

export const runtime = "nodejs";

/** The rules engine's verdict and a price for a spec. */
export async function POST(request: Request) {
  const body = await parseBody(request, validateRequestSchema);
  if (!body.ok) return body.response;
  try {
    const { spec } = body.data;
    return Response.json({ report: validateSpec(spec), quote: priceSpec(spec) });
  } catch (error) {
    return internalError("POST /api/validate", error);
  }
}
