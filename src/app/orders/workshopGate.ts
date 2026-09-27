import { cookies, headers } from "next/headers";
import { isWorkshopRequest } from "@/server/workshopAuth";

/**
 * Whether this request may see the workshop pages. The cookie is read through cookies(), not the raw
 * request headers, so the re-render that follows signing in or out already sees the change.
 */
export async function canSeeWorkshop(): Promise<boolean> {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const current = new Headers(requestHeaders);
  current.set("cookie", cookieStore.toString());
  return isWorkshopRequest(current);
}
