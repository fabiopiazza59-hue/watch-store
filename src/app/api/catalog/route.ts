import { CATALOG, SLOTS, TEMPLATES } from "@/domain/catalog";

export const runtime = "nodejs";

/** The parts library, the configurator slots and the starting templates. */
export function GET() {
  return Response.json({ catalog: CATALOG, slots: SLOTS, templates: TEMPLATES });
}
