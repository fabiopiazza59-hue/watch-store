import type { WatchSpec } from "../types";

/** Why the offline designer answered instead of Claude. */
export type FallbackReason = "no-key" | "refusal" | "unavailable";

/** A designer's proposal, before the rules report, quote and change list are attached. */
export interface DesignDraft {
  mode: "claude" | "offline";
  spec: WatchSpec;
  reply: string;
}
