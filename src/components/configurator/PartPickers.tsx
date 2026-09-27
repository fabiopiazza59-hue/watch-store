import { type ReactNode, useId, useMemo, useState } from "react";
import { NONE_OPTION_ID, SLOTS } from "@/domain/catalog";
import type { Issue, ResolvedSpec, SlotDef, SlotKey, SuggestedFix, ValidationReport, WatchSpec } from "@/domain/types";
import { partHighlights, partSwatch } from "../parts/partInfo";
import { PartSwatch, SwatchPlaceholder } from "../parts/PartSwatch";
import { formatPriceDelta, plural } from "../ui/format";
import { AlertIcon, ChevronIcon, CrossIcon, SparkIcon } from "../ui/icons";
import { buttonClass } from "../ui/styles";
import { FitBadge } from "./FitBadge";
import { type Attention, slotAttention } from "./fit";
import { pickerOptions } from "./pickerOptions";

export function pickerId(slot: SlotKey): string {
  return `picker-${slot}`;
}

export function pickerToggleId(slot: SlotKey): string {
  return `picker-${slot}-toggle`;
}

/** Fixes shown right under a picker; the "Can we build it?" panel lists them all. */
const PICKER_FIXES = 2;

interface PartPickersProps {
  spec: WatchSpec;
  parts: ResolvedSpec;
  report: ValidationReport;
  expandedSlots: SlotKey[];
  /** The slot the customer chose a part for last: repairs keep that part. */
  lastChangedSlot: SlotKey | null;
  onToggleSlot: (slot: SlotKey) => void;
  onChoose: (slot: SlotKey, partId: string | null) => void;
  /** A choice that also changes other parts, so the customer can undo it. */
  onReplace: (next: WatchSpec, label: string, changedSlot: SlotKey) => void;
  onApplyFix: (fix: SuggestedFix) => void;
  /** Repairs the design around the part chosen last. False when nothing in the catalogue fits around it. */
  onKeepChoice: () => boolean;
}

export function PartPickers({ spec, parts, report, expandedSlots, lastChangedSlot, ...handlers }: PartPickersProps) {
  const attention = slotAttention(report);
  return (
    <div className="flex flex-col gap-3">
      {SLOTS.map((def) => (
        <PartPicker
          key={def.slot}
          def={def}
          spec={spec}
          parts={parts}
          problems={report.issues.filter((issue) => issue.severity === "error" && issue.slots.includes(def.slot))}
          attention={attention[def.slot]}
          expanded={expandedSlots.includes(def.slot)}
          lastChangedSlot={lastChangedSlot}
          onToggle={() => handlers.onToggleSlot(def.slot)}
          onChoose={(partId) => handlers.onChoose(def.slot, partId)}
          onReplace={(next, label) => handlers.onReplace(next, label, def.slot)}
          onApplyFix={handlers.onApplyFix}
          onKeepChoice={handlers.onKeepChoice}
        />
      ))}
    </div>
  );
}

const ATTENTION_LABELS: Record<Attention, string> = { error: "Needs a change", warning: "Has a caveat" };

interface PartPickerProps {
  def: SlotDef;
  spec: WatchSpec;
  parts: ResolvedSpec;
  /** Errors that involve this slot, as the design stands. */
  problems: Issue[];
  attention?: Attention;
  expanded: boolean;
  lastChangedSlot: SlotKey | null;
  onToggle: () => void;
  onChoose: (partId: string | null) => void;
  onReplace: (next: WatchSpec, label: string) => void;
  onApplyFix: (fix: SuggestedFix) => void;
  onKeepChoice: () => boolean;
}

function PartPicker({ def, spec, parts, problems, attention, expanded, lastChangedSlot, ...handlers }: PartPickerProps) {
  const headingId = useId();
  const listId = useId();
  const current = parts[def.category];
  const swatch = current ? partSwatch(current) : null;
  const emptyLabel = def.optional ? `No ${def.label.toLowerCase()}` : "Not chosen yet";
  // Right under the chosen option while the list is open (it can be a long way down), else under the header.
  const problem = problems.length > 0 && (
    <PickerProblem
      spec={spec}
      problems={problems}
      keepLabel={
        def.slot === lastChangedSlot && current ? `Keep the ${current.name} ${def.label.toLowerCase()}, fix the rest` : null
      }
      onApplyFix={handlers.onApplyFix}
      onKeepChoice={handlers.onKeepChoice}
    />
  );

  return (
    <section
      id={pickerId(def.slot)}
      aria-labelledby={headingId}
      className={`scroll-mt-6 rounded-xl border bg-surface ${attention === "error" ? "border-danger/50" : "border-line"}`}
    >
      <div className="flex items-start gap-3 p-4">
        {swatch ? <PartSwatch swatch={swatch} className="mt-1 size-8" /> : <SwatchPlaceholder className="mt-1 size-8" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={headingId} className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
              {def.label}
            </h3>
            {attention && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  attention === "error" ? "text-danger" : "text-warn"
                }`}
              >
                {attention === "error" ? <CrossIcon className="size-3.5" /> : <AlertIcon className="size-3.5" />}
                {ATTENTION_LABELS[attention]}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-medium text-ink">{current?.name ?? emptyLabel}</p>
          {current && <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{partHighlights(current).join(" · ")}</p>}
        </div>
        <button
          type="button"
          id={pickerToggleId(def.slot)}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={handlers.onToggle}
          className={`${buttonClass("secondary", "sm")} shrink-0`}
        >
          {expanded ? "Done" : "Change"}
          <span className="sr-only"> {def.label.toLowerCase()}</span>
          <ChevronIcon className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      {expanded ? (
        <OptionList
          id={listId}
          def={def}
          spec={spec}
          lastChangedSlot={lastChangedSlot}
          selectedProblem={problem}
          onChoose={handlers.onChoose}
          onReplace={handlers.onReplace}
        />
      ) : (
        problem
      )}
    </section>
  );
}

interface PickerProblemProps {
  spec: WatchSpec;
  problems: Issue[];
  /** Offered for the part the customer chose last. */
  keepLabel: string | null;
  onApplyFix: (fix: SuggestedFix) => void;
  onKeepChoice: () => boolean;
}

/** The first thing stopping the build that involves this part, with its fixes, right where the part was chosen. */
function PickerProblem({ spec, problems, keepLabel, onApplyFix, onKeepChoice }: PickerProblemProps) {
  const [stuckOn, setStuckOn] = useState<WatchSpec | null>(null);
  const [lead] = problems;
  const more = problems.length - 1;

  return (
    <div className="border-t border-danger/20 bg-danger-soft/40 px-4 py-3">
      <p className="flex gap-2 text-sm leading-relaxed text-ink">
        <CrossIcon className="mt-0.5 size-4 shrink-0 text-danger" />
        <span>{lead.message}</span>
      </p>
      {lead.fixes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5 pl-6">
          {lead.fixes.slice(0, PICKER_FIXES).map((fix) => (
            <li key={fix.description} className="flex items-center justify-between gap-3 rounded-md bg-surface/80 py-1.5 pr-1.5 pl-3">
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
      {(keepLabel || more > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-6">
          {keepLabel && (
            <button
              type="button"
              onClick={() => setStuckOn(onKeepChoice() ? null : spec)}
              // The label names the part, so it can wrap onto a second line on a phone.
              className={`${buttonClass("secondary", "sm")} h-auto! min-h-10 py-2 text-left sm:min-h-8 sm:py-1`}
            >
              <SparkIcon className="size-4 shrink-0 text-brass-ink" />
              {keepLabel}
            </button>
          )}
          {more > 0 && (
            <a href="#feasibility" className="text-xs text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink">
              {plural(more, "more problem")} with this part
            </a>
          )}
        </div>
      )}
      <p role="status" className="pl-6 text-xs text-danger">
        {stuckOn === spec ? "Nothing in our catalogue fits around it yet, so nothing was changed." : ""}
      </p>
    </div>
  );
}

interface OptionListProps {
  id: string;
  def: SlotDef;
  spec: WatchSpec;
  lastChangedSlot: SlotKey | null;
  /** What stops the chosen option from fitting, with its fixes, shown under it. */
  selectedProblem: ReactNode;
  onChoose: (partId: string | null) => void;
  onReplace: (next: WatchSpec, label: string) => void;
}

function OptionList({ id, def, spec, lastChangedSlot, selectedProblem, onChoose, onReplace }: OptionListProps) {
  // Judging every option takes a few repairs; typing the design's name needn't redo them.
  const design = JSON.stringify({ ...spec, name: "" });
  const options = useMemo(
    () => pickerOptions(def.slot, JSON.parse(design) as WatchSpec, lastChangedSlot),
    [def.slot, design, lastChangedSlot],
  );
  // An empty insert id (from an old saved design) means no insert, like null.
  const selectedId = spec[def.slot] || NONE_OPTION_ID;
  // A part the catalogue doesn't list has no option to show its problem under.
  const unlisted = !options.some((option) => option.optionId === selectedId);
  const hasSwatches = options.some(({ part }) => part && partSwatch(part));
  const fitting = options.filter((option) => option.fit === "fits" || option.fit === "caveats").length;
  const withChanges = options.filter((option) => option.fit === "fits-with-changes").length;

  return (
    <fieldset id={id} className="border-t border-line px-2 pt-2 pb-2">
      <legend className="sr-only">Choose the {def.label.toLowerCase()}</legend>
      <p className="px-2 pt-1 pb-2 text-xs text-ink-faint">
        {fitting} of {options.length} fit the rest of this design
        {withChanges > 0 && `, ${withChanges} more if other parts change to suit`}. Parts that won&rsquo;t fit stay
        selectable, so you can see why.
      </p>
      {unlisted && selectedProblem && <div className="mb-2 overflow-hidden rounded-lg">{selectedProblem}</div>}
      <ul className="flex flex-col gap-1">
        {options.map(({ optionId, partId, part, fit, reason, adjusted, priceDeltaEur }) => {
          const selected = optionId === selectedId;
          const reasonId = `${id}-${optionId}-reason`;
          const swatch = part ? partSwatch(part) : null;
          const name = part?.name ?? `No ${def.label.toLowerCase()}`;
          const problem = selected ? selectedProblem : null;
          // The chosen option's problem shows in full, with its fixes, just below it.
          const explanation = adjusted
            ? { text: `To fit, this also changes ${adjusted.changes.join("; ")}.`, tone: "text-info" }
            : reason && !problem && { text: reason.message, tone: reason.severity === "error" ? "text-danger" : "text-warn" };
          const choose = () =>
            adjusted
              ? onReplace(
                  { ...adjusted.spec, name: spec.name },
                  `Switched to ${name} and changed ${plural(adjusted.changes.length, "other part")} to suit it.`,
                )
              : onChoose(partId);
          return (
            <li key={optionId}>
              <label
                className={`group flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-brass-ink ${
                  selected ? "border-brass/60 bg-brass-soft" : "border-transparent hover:bg-surface-muted"
                }`}
              >
                <input
                  type="radio"
                  name={`option-${def.slot}`}
                  value={optionId}
                  checked={selected}
                  onChange={choose}
                  aria-describedby={explanation ? reasonId : undefined}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`mt-1 size-4 shrink-0 rounded-full border ${
                    selected ? "border-[5px] border-ink bg-surface" : "border-control-border bg-surface"
                  }`}
                />
                {swatch ? (
                  <PartSwatch
                    swatch={swatch}
                    className={`size-6 ${fit === "wont-fit" ? "opacity-50 grayscale-[40%] group-hover:opacity-100" : ""}`}
                  />
                ) : (
                  hasSwatches && <SwatchPlaceholder className="size-6" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`text-sm font-medium ${fit === "wont-fit" ? "text-ink-soft" : "text-ink"}`}>{name}</span>
                    <FitBadge fit={fit} changeCount={adjusted?.changes.length} />
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {part ? partHighlights(part).join(" · ") : "Leave this out"}
                  </span>
                  {explanation && (
                    <span
                      id={reasonId}
                      className={`mt-1 text-xs leading-relaxed ${explanation.tone} ${
                        // Always in full for the chosen part and on touch screens, which can't hover.
                        selected
                          ? "block"
                          : "line-clamp-2 group-hover:line-clamp-none group-has-focus-visible:line-clamp-none pointer-coarse:line-clamp-none"
                      }`}
                    >
                      {explanation.text}
                    </span>
                  )}
                </span>
                <span className="shrink-0 pt-0.5 text-xs text-ink-soft tabular-nums">
                  {selected ? (
                    "Chosen"
                  ) : (
                    <>
                      <span className="sr-only">Price change </span>
                      {formatPriceDelta(priceDeltaEur)}
                    </>
                  )}
                </span>
              </label>
              {problem && <div className="mt-1 overflow-hidden rounded-lg">{problem}</div>}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
