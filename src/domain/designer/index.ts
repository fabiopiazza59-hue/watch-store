// The AI designer. Server-only: it may call the Claude API, and falls back to the offline designer
// when no API key is configured. Either way, the rules engine has the final word on the result.
import { DEFAULT_SPEC } from "../catalog";
import { priceSpec } from "../pricing";
import { validateSpec } from "../rules";
import type { DesignRequest, DesignResponse } from "../types";
import { configuredModel, designWithClaude } from "./claude";
import { describeSpecChanges } from "./diff";
import { designOffline } from "./offline";

export interface DesignerStatus {
  mode: DesignResponse["mode"];
  /** The Claude model in use, or null in offline mode. */
  model: string | null;
}

function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function designerStatus(): DesignerStatus {
  return hasApiKey() ? { mode: "claude", model: configuredModel() } : { mode: "offline", model: null };
}

export async function designWatch(req: DesignRequest): Promise<DesignResponse> {
  const draft = hasApiKey() ? await designWithClaude(req) : designOffline(req, "no-key");
  return {
    ...draft,
    report: validateSpec(draft.spec),
    quote: priceSpec(draft.spec),
    changes: describeSpecChanges(req.currentSpec ?? DEFAULT_SPEC, draft.spec),
  };
}
