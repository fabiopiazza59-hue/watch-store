// CONTRACT STUB — implemented by the AI-designer build step. Keep this signature.
// Server-only: may call the Claude API. Falls back to an offline designer when no API key is configured.
import type { DesignRequest, DesignResponse } from "../types";

export async function designWatch(req: DesignRequest): Promise<DesignResponse> {
  void req;
  throw new Error("designWatch: not implemented");
}
