// The AI designer. Server-only: it may call the Claude API, and falls back to the offline designer
// when no API key is configured. Either way, the rules engine has the final word on the result.
import type { DesignRequest, DesignResponse } from "../types";
import { configuredModel, designWithClaude } from "./claude";
import { designOffline } from "./offline";
import { normalizeRequest, toResponse } from "./respond";
import type { DesignDraft } from "./types";

export interface DesignerStatus {
  mode: DesignResponse["mode"];
  /** The Claude model in use, or null in offline mode. */
  model: string | null;
}

export interface DesignOptions {
  /** Ends a Claude conversation early, e.g. when the customer has gone. */
  signal?: AbortSignal;
  /** False has the offline designer answer even with an API key, e.g. once a daily cap is reached. */
  claude?: boolean;
}

function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function designerStatus(): DesignerStatus {
  return hasApiKey() ? { mode: "claude", model: configuredModel() } : { mode: "offline", model: null };
}

let missingKeyLogged = false;

/** Customers only see which designer answered; why is for whoever runs the server. */
function logMissingKeyOnce(): void {
  if (missingKeyLogged) return;
  missingKeyLogged = true;
  console.warn("[designer] ANTHROPIC_API_KEY is not set, so the offline designer answers. Set it to use the Claude designer.");
}

async function draftDesign(req: DesignRequest, { signal, claude = true }: DesignOptions): Promise<DesignDraft> {
  if (!hasApiKey()) {
    logMissingKeyOnce();
    return designOffline(req, "no-key");
  }
  return claude ? designWithClaude(req, { signal }) : designOffline(req, "unavailable");
}

export async function designWatch(request: DesignRequest, options: DesignOptions = {}): Promise<DesignResponse> {
  const req = normalizeRequest(request);
  return toResponse(req, await draftDesign(req, options));
}
