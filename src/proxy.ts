// A second lock on the workshop's order API (Next 16's renamed middleware). Every route handler
// under /api/orders checks the workshop token itself; this makes a handler added later that forgets
// to check fail closed. Placing an order (POST /api/orders) stays open to customers. The workshop
// pages aren't matched: they render their own sign-in form, which a redirect here would bypass.
import { NextResponse, type NextRequest } from "next/server";
import { workshopOnly } from "@/app/api/_lib/orders";
import { isWorkshopRequest } from "@/server/workshopAuth";

export function proxy(request: NextRequest): Response {
  const placingAnOrder = request.method === "POST" && request.nextUrl.pathname === "/api/orders";
  if (placingAnOrder || isWorkshopRequest(request.headers)) return NextResponse.next();
  return workshopOnly();
}

export const config = {
  matcher: ["/api/orders", "/api/orders/:path*"],
};
