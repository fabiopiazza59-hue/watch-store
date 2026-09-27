// The designer for the static demo, which has no server: the offline designer, run in the browser.
// Kept apart from ./index so the browser bundle never includes the Claude client.
import type { DesignRequest, DesignResponse } from "../types";
import { designOffline } from "./offline";
import { normalizeRequest, toResponse } from "./respond";

export function designInBrowser(request: DesignRequest): DesignResponse {
  const req = normalizeRequest(request);
  return toResponse(req, designOffline(req, "no-key"));
}
