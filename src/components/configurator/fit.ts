import type { Issue, OptionStatus, Severity, SlotKey, ValidationReport } from "@/domain/types";
import { plural } from "../ui/format";

/**
 * How well a candidate part fits the rest of the design. "fits-with-changes": it doesn't fit as the
 * design stands, but it does once a few other parts change to suit it.
 */
export type Fit = "fits" | "caveats" | "fits-with-changes" | "wont-fit";

/** "Fits with 3 changes"; `changeCount` only counts for "fits-with-changes". */
export function fitLabel(fit: Fit, changeCount = 0): string {
  switch (fit) {
    case "fits":
      return "Fits";
    case "caveats":
      return "Fits with caveats";
    case "fits-with-changes":
      return `Fits with ${plural(changeCount, "change")}`;
    case "wont-fit":
      return "Won't fit";
  }
}

export function fitOf(option: OptionStatus): Fit {
  if (!option.compatible) return "wont-fit";
  return option.issues.length > 0 ? "caveats" : "fits";
}

/** The issue that best explains an option's fit: its first error, else its first warning. */
export function leadIssue(option: OptionStatus): Issue | undefined {
  return option.issues.find((issue) => issue.severity === "error") ?? option.issues[0];
}

export type Attention = Extract<Severity, "error" | "warning">;

/** Which pickers the current report's errors and warnings involve; errors win over warnings. */
export function slotAttention(report: ValidationReport): Partial<Record<SlotKey, Attention>> {
  const attention: Partial<Record<SlotKey, Attention>> = {};
  for (const issue of report.issues) {
    if (issue.severity === "info") continue;
    for (const slot of issue.slots) {
      if (attention[slot] !== "error") attention[slot] = issue.severity;
    }
  }
  return attention;
}
