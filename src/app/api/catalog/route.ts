import { CATALOG, EXTRAS, SLOTS, TEMPLATES } from "@/domain/catalog";

export const runtime = "nodejs";

/** The parts library, the configurator slots, the starting templates and the add-ons. */
export function GET() {
  return Response.json({ catalog: CATALOG, slots: SLOTS, templates: TEMPLATES, extras: EXTRAS });
}
