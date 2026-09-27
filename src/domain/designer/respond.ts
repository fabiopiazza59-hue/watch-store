// The steps every designer shares, whichever answers (Claude, the offline designer on the server, or
// the offline designer in the static demo's browser): clean the request's texts, then turn the
// draft into the response the configurator shows, judged by the rules engine.
import { DEFAULT_SPEC } from "../catalog";
import { priceSpec } from "../pricing";
import { normalizePersonalization, validateSpec } from "../rules";
import { clampDesignName } from "../schemas";
import type { DesignRequest, DesignResponse } from "../types";
import { describeSpecChanges } from "./diff";
import type { DesignDraft } from "./types";

/**
 * Texts in the design on screen arrive as typed (a share link, an old saved design): made plain
 * first, so a designer never drops "For Dad – 1953" as unprintable when it means "For Dad - 1953".
 */
export function normalizeRequest(request: DesignRequest): DesignRequest {
  if (!request.currentSpec) return request;
  return {
    ...request,
    currentSpec: { ...request.currentSpec, personalization: normalizePersonalization(request.currentSpec.personalization) },
  };
}

/**
 * Whatever the designer proposed must round-trip through the API schemas (reload, share, order),
 * with its texts as the order store will keep them.
 */
export function toResponse(req: DesignRequest, draft: DesignDraft): DesignResponse {
  const spec = {
    ...draft.spec,
    name: clampDesignName(draft.spec.name),
    personalization: normalizePersonalization(draft.spec.personalization),
  };
  return {
    ...draft,
    spec,
    report: validateSpec(spec),
    quote: priceSpec(spec),
    changes: describeSpecChanges(req.currentSpec ?? DEFAULT_SPEC, spec),
  };
}
