import type { Issue, OptionStatus, Severity, SlotKey, ValidationReport } from "@/domain/types";

/** How well a candidate part fits the rest of the design. */
export type Fit = "fits" | "caveats" | "wont-fit";

export const FIT_LABELS: Record<Fit, string> = {
  fits: "Fits",
  caveats: "Fits with caveats",
  "wont-fit": "Won't fit",
};

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
