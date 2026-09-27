import Link from "next/link";
import { useState } from "react";
import { getSlotDef } from "@/domain/catalog";
import { repairSpec } from "@/domain/rules";
import type { Issue, Severity, SlotKey, SuggestedFix, ValidationReport, WatchSpec } from "@/domain/types";
import { plural } from "../ui/format";
import { AlertIcon, CheckIcon, CrossIcon, InfoIcon, SparkIcon } from "../ui/icons";
import { buttonClass, cardClass } from "../ui/styles";

const SEVERITY_GROUPS: { severity: Severity; title: string; blurb: string }[] = [
  {
    severity: "error",
    title: "Must change",
    blurb: "These stop the watch from being assembled, or would make it faulty.",
  },
  {
    severity: "warning",
    title: "Worth knowing",
    blurb: "It can be built, with a trade-off you should accept knowingly.",
  },
  { severity: "info", title: "Good to know", blurb: "Matters of taste and small details. Never a blocker." },
];

const SEVERITY_STYLES: Record<Severity, { icon: typeof CrossIcon; tone: string; panel: string }> = {
  error: { icon: CrossIcon, tone: "text-danger", panel: "border-danger/25 bg-danger-soft/60" },
  warning: { icon: AlertIcon, tone: "text-warn", panel: "border-warn/25 bg-warn-soft/60" },
  info: { icon: InfoIcon, tone: "text-info", panel: "border-info/20 bg-info-soft/50" },
};

/** A message tied to the design it was about, so it disappears as soon as the design moves on. */
interface Notice {
  spec: WatchSpec;
  title: string;
  lines: string[];
}

interface FeasibilityPanelProps {
  spec: WatchSpec;
  report: ValidationReport;
  /** A small edit, such as one applied fix. */
  onChange: (next: WatchSpec) => void;
  /** A sweeping change the customer may want to undo. */
  onReplace: (next: WatchSpec, label: string) => void;
  onRevealSlot: (slot: SlotKey) => void;
}

export function FeasibilityPanel({ spec, report, onChange, onReplace, onRevealSlot }: FeasibilityPanelProps) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const errors = report.issues.filter((issue) => issue.severity === "error");
  const warnings = report.issues.filter((issue) => issue.severity === "warning");
  const canRepair = errors.some((issue) => issue.fixes.length > 0);
  const visibleNotice = notice?.spec === spec ? notice : null;

  function applyFix(fix: SuggestedFix) {
    const next = { ...spec, ...fix.patch };
    onChange(next);
    setNotice({ spec: next, title: "Applied", lines: [fix.description] });
  }

  function repairEverything() {
    const result = repairSpec(spec);
    onReplace(result.spec, "Applied automatic fixes.");
    setNotice({
      spec: result.spec,
      title: result.report.buildable
        ? "Done: it can be built now. Here's what changed:"
        : "I fixed what I could. The rest needs your call:",
      lines: result.changes.length > 0 ? result.changes : ["No automatic fix applied to what's left."],
    });
  }

  return (
    <section id="feasibility" aria-labelledby="feasibility-title" className={`${cardClass} scroll-mt-6 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="feasibility-title" className="font-display text-xl font-semibold text-ink">
          Can we build it?
        </h2>
        <Link href="/how-it-works" className="text-xs text-ink-faint underline decoration-line-strong underline-offset-4 hover:text-ink">
          Checked by our rules engine, not the AI
        </Link>
      </div>

      <Verdict buildable={report.buildable} errorCount={errors.length} warningCount={warnings.length} />

      {!report.buildable && canRepair && (
        <button type="button" onClick={repairEverything} className={`${buttonClass("primary", "md")} mt-4 w-full sm:w-auto`}>
          <SparkIcon />
          Fix everything for me
        </button>
      )}

      <div role="status" aria-live="polite">
        {visibleNotice && (
          <div className="mt-4 rounded-lg border border-line bg-surface-muted p-3 text-sm">
            <p className="font-medium text-ink">{visibleNotice.title}</p>
            <ul className="mt-1 list-disc pl-5 text-ink-soft">
              {visibleNotice.lines.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {report.issues.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          No issues at all: every dimension checks out, from dial seat to lug width.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {SEVERITY_GROUPS.map(({ severity, title, blurb }) => {
            const issues = report.issues.filter((issue) => issue.severity === severity);
            if (issues.length === 0) return null;
            return (
              <div key={severity}>
                <h3 className={`flex items-center gap-2 text-sm font-semibold ${SEVERITY_STYLES[severity].tone}`}>
                  {title}
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">
                    {issues.length}
                  </span>
                </h3>
                <p className="mt-0.5 text-xs text-ink-faint">{blurb}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {issues.map((issue, index) => (
                    <IssueItem
                      key={`${issue.ruleId}-${index}`}
                      issue={issue}
                      onApplyFix={applyFix}
                      onRevealSlot={onRevealSlot}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Verdict({ buildable, errorCount, warningCount }: { buildable: boolean; errorCount: number; warningCount: number }) {
  if (!buildable) {
    return (
      <div className="mt-4 flex items-start gap-4 rounded-xl bg-danger-soft p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger text-paper">
          <CrossIcon className="size-6" />
        </span>
        <div>
          <p className="font-display text-2xl font-semibold text-danger">Needs changes</p>
          <p className="mt-1 text-sm text-ink-soft">
            {plural(errorCount, "thing")} would stop us assembling it. Each one explains why, with fixes you can apply
            in one click.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 flex items-start gap-4 rounded-xl bg-ok-soft p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ok text-paper">
        <CheckIcon className="size-6" />
      </span>
      <div>
        <p className="font-display text-2xl font-semibold text-ok">Buildable</p>
        <p className="mt-1 text-sm text-ink-soft">
          {warningCount === 0
            ? "Every part fits. We can assemble this watch by hand exactly as shown."
            : `Every part fits. There ${warningCount === 1 ? "is one caveat" : `are ${warningCount} caveats`} worth reading before you order.`}
        </p>
      </div>
    </div>
  );
}

interface IssueItemProps {
  issue: Issue;
  onApplyFix: (fix: SuggestedFix) => void;
  onRevealSlot: (slot: SlotKey) => void;
}

function IssueItem({ issue, onApplyFix, onRevealSlot }: IssueItemProps) {
  const { icon: Icon, tone, panel } = SEVERITY_STYLES[issue.severity];
  return (
    <li className={`flex gap-3 rounded-lg border p-3 ${panel}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-ink">{issue.message}</p>
        {issue.slots.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
            <span>Involves</span>
            {issue.slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onRevealSlot(slot)}
                className="rounded-full border border-line-strong bg-surface px-2 py-0.5 text-ink-soft hover:border-ink/40 hover:text-ink"
              >
                {getSlotDef(slot).label}
              </button>
            ))}
          </p>
        )}
        {issue.fixes.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {issue.fixes.map((fix) => (
              <li
                key={fix.description}
                className="flex items-center justify-between gap-3 rounded-md bg-surface/80 py-1.5 pr-1.5 pl-3"
              >
                <span className="text-sm text-ink-soft">{fix.description}</span>
                <button
                  type="button"
                  onClick={() => onApplyFix(fix)}
                  aria-label={`Apply: ${fix.description}`}
                  className={buttonClass("secondary", "sm")}
                >
                  Apply
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
