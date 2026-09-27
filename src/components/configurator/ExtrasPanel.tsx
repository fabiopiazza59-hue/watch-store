import { type ReactNode, useId, useMemo, useState } from "react";
import { NONE_OPTION_ID, specExtras } from "@/domain/catalog";
import type { Issue, OrderExtras, ResolvedSpec, SuggestedFix, ValidationReport, WatchSpec } from "@/domain/types";
import { partHighlights, partSwatch } from "../parts/partInfo";
import { PartSwatch, SwatchPlaceholder } from "../parts/PartSwatch";
import { formatMm, formatPrice, formatPriceDelta } from "../ui/format";
import { AlertIcon, CrossIcon } from "../ui/icons";
import { buttonClass, cardClass } from "../ui/styles";
import { FitBadge } from "./FitBadge";
import {
  type AddOnGroup,
  type AddOnOption,
  addOnGroups,
  extrasPriceEur,
  hasExtras,
  isExtrasIssue,
  setSpareStrap,
  type SpareStrapOption,
  spareStrapOptions,
  toggleExtraItem,
  visibleSpareStrapOptions,
} from "./extrasOptions";

/** Anchor for links that bring the extras into view, such as an extras issue's chip. */
export const EXTRAS_PANEL_ID = "extras";
/** Focused when an issue brings the panel into view. */
export const EXTRAS_TITLE_ID = "extras-title";

/** Fixes shown under a problem here; the "Can we build it?" panel lists them all. */
const PANEL_FIXES = 3;

interface ExtrasPanelProps {
  spec: WatchSpec;
  parts: ResolvedSpec;
  report: ValidationReport;
  onChange: (extras: OrderExtras) => void;
  onApplyFix: (fix: SuggestedFix) => void;
}

/** The spare strap and the add-ons that ship with the watch, each with what it adds to the price. */
export function ExtrasPanel({ spec, parts, report, onChange, onApplyFix }: ExtrasPanelProps) {
  const extras = specExtras(spec);
  const issues = report.issues.filter((issue) => isExtrasIssue(issue) && issue.severity !== "info");
  const strapIssues = issues.filter((issue) => issue.ruleId === "spare-strap");
  const otherIssues = issues.filter((issue) => issue.ruleId !== "spare-strap");
  const needsChange = issues.some((issue) => issue.severity === "error");
  // Judging every option prices the design a few dozen times; typing its name needn't redo that.
  const design = JSON.stringify({ ...spec, name: "" });
  const { strapOptions, groups, totalEur } = useMemo(() => {
    const judged = JSON.parse(design) as WatchSpec;
    return { strapOptions: spareStrapOptions(judged), groups: addOnGroups(judged), totalEur: extrasPriceEur(judged) };
  }, [design]);

  return (
    <section
      id={EXTRAS_PANEL_ID}
      aria-labelledby={EXTRAS_TITLE_ID}
      className={`${cardClass} scroll-mt-6 p-4 ${needsChange ? "border-danger/50" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3
          id={EXTRAS_TITLE_ID}
          tabIndex={-1}
          className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase focus-visible:outline-offset-4"
        >
          Add extras
        </h3>
        {issues.length > 0 && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${needsChange ? "text-danger" : "text-warn"}`}>
            {needsChange ? <CrossIcon className="size-3.5" /> : <AlertIcon className="size-3.5" />}
            {needsChange ? "Needs a change" : "Has a caveat"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        A spare strap and a few things to go with the watch. All optional; each shows what it adds to your price, VAT
        included.
      </p>

      <SpareStrapPicker
        options={strapOptions}
        selectedId={extras.spareStrapId ?? NONE_OPTION_ID}
        lugWidthMm={parts.case?.lugWidthMm}
        problems={strapIssues}
        onChoose={(strapId) => onChange(setSpareStrap(extras, strapId))}
        onApplyFix={onApplyFix}
      />

      <AddOns
        groups={groups}
        problems={otherIssues}
        onToggle={(id, on) => onChange(toggleExtraItem(extras, id, on))}
        onApplyFix={onApplyFix}
      />

      {hasExtras(extras) && (
        <p className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-sm">
          <span className="text-ink-soft">Your extras add</span>
          <span className="font-medium text-ink tabular-nums">{formatPrice(totalEur)}</span>
        </p>
      )}
    </section>
  );
}

interface SpareStrapPickerProps {
  options: SpareStrapOption[];
  selectedId: string;
  lugWidthMm?: number;
  /** The rules engine's spare-strap issues, as the design stands. */
  problems: Issue[];
  onChoose: (strapId: string | null) => void;
  onApplyFix: (fix: SuggestedFix) => void;
}

function SpareStrapPicker({ options, selectedId, lugWidthMm, problems, onChoose, onApplyFix }: SpareStrapPickerProps) {
  const [showAll, setShowAll] = useState(false);
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const visible = visibleSpareStrapOptions(options, selectedId, showAll);
  const wontFit = options.filter((option) => option.fit === "wont-fit" && option.optionId !== selectedId).length;
  // A spare strap the catalogue doesn't list has no row to show its problem under.
  const unlisted = !options.some((option) => option.optionId === selectedId);
  const problem = problems.length > 0 && <ExtrasProblems issues={problems} onApplyFix={onApplyFix} />;

  return (
    <fieldset className="mt-4" aria-describedby={hintId}>
      <legend className="text-sm font-medium text-ink">Spare strap</legend>
      <p id={hintId} className="mt-0.5 text-xs leading-relaxed text-ink-faint">
        A second strap in the box, to swap in yourself
        {lugWidthMm ? `. It has to fit this case's ${formatMm(lugWidthMm)} lugs.` : "."}
      </p>
      {unlisted && problem && <div className="mt-2">{problem}</div>}
      <ul id={listId} className="mt-2 flex flex-col gap-1">
        {visible.map((option) => (
          <SpareStrapRow
            key={option.optionId}
            option={option}
            name={`${id}-spare-strap`}
            selected={option.optionId === selectedId}
            problem={option.optionId === selectedId ? problem : null}
            onChoose={() => onChoose(option.strapId)}
          />
        ))}
      </ul>
      {wontFit > 0 && (
        <button
          type="button"
          aria-controls={listId}
          aria-expanded={showAll}
          onClick={() => setShowAll((current) => !current)}
          className="mt-1 inline-flex min-h-10 items-center px-3 text-xs text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink sm:min-h-8"
        >
          {showAll ? "Hide straps that won't fit" : `Show ${wontFit} more that won't fit`}
        </button>
      )}
    </fieldset>
  );
}

interface SpareStrapRowProps {
  option: SpareStrapOption;
  /** The radio group's name. */
  name: string;
  selected: boolean;
  /** What stops the chosen strap from fitting, with its fixes, shown under it. */
  problem: ReactNode;
  onChoose: () => void;
}

function SpareStrapRow({ option, name, selected, problem, onChoose }: SpareStrapRowProps) {
  const reasonId = useId();
  const { strap, fit, reason, priceDeltaEur } = option;
  const swatch = strap ? partSwatch(strap) : null;
  const wontFit = fit === "wont-fit";
  // The chosen strap's problem shows in full, with its fixes, just below it.
  const explanation = reason && !problem ? reason : null;

  return (
    <li>
      <label
        className={`group flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-brass-ink ${
          selected ? "border-brass/60 bg-brass-soft" : "border-transparent hover:bg-surface-muted"
        }`}
      >
        <input
          type="radio"
          name={name}
          value={option.optionId}
          checked={selected}
          onChange={onChoose}
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
            className={`size-6 ${wontFit ? "opacity-50 grayscale-[40%] group-hover:opacity-100" : ""}`}
          />
        ) : (
          <SwatchPlaceholder className="size-6" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-sm font-medium ${wontFit ? "text-ink-soft" : "text-ink"}`}>
              {strap?.name ?? (option.strapId === null ? "No spare strap" : option.strapId)}
            </span>
            {option.strapId !== null && <FitBadge fit={fit} />}
          </span>
          <span className="mt-0.5 block text-xs text-ink-faint">
            {strap
              ? [...partHighlights(strap), ...(option.sameAsWatch ? ["same as on the watch"] : [])].join(" · ")
              : "Just the strap on the watch"}
          </span>
          {explanation && (
            <span
              id={reasonId}
              className={`mt-1 text-xs leading-relaxed ${explanation.severity === "error" ? "text-danger" : "text-warn"} ${
                selected
                  ? "block"
                  : "line-clamp-2 group-hover:line-clamp-none group-has-focus-visible:line-clamp-none pointer-coarse:line-clamp-none"
              }`}
            >
              {explanation.message}
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
      {problem && <div className="mt-1">{problem}</div>}
    </li>
  );
}

interface AddOnsProps {
  groups: AddOnGroup[];
  /** The rules engine's other extras issues, such as an add-on it doesn't know. */
  problems: Issue[];
  onToggle: (id: string, on: boolean) => void;
  onApplyFix: (fix: SuggestedFix) => void;
}

function AddOns({ groups, problems, onToggle, onApplyFix }: AddOnsProps) {
  const id = useId();
  return (
    <div className="mt-5 border-t border-line pt-4">
      <fieldset>
        <legend className="text-sm font-medium text-ink">Add-ons</legend>
        <div className="mt-2 flex flex-col gap-4">
          {groups.map((group, index) => (
            <div key={group.title} role="group" aria-labelledby={`${id}-group-${index}`}>
              <p id={`${id}-group-${index}`} className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">
                {group.title}
              </p>
              <ul className="mt-1.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {group.options.map((option) => (
                  <AddOnCard
                    key={option.extra.id}
                    option={option}
                    onToggle={(on) => onToggle(option.extra.id, on)}
                  />
                ))}
              </ul>
            </div>
          ))}
          {problems.length > 0 && <ExtrasProblems issues={problems} onApplyFix={onApplyFix} />}
        </div>
      </fieldset>
    </div>
  );
}

function AddOnCard({ option, onToggle }: { option: AddOnOption; onToggle: (on: boolean) => void }) {
  const id = useId();
  const { extra, selected, priceDeltaEur } = option;
  const added = Math.max(0, Math.round(priceDeltaEur));
  return (
    <li className="flex">
      <label
        className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
          selected ? "border-brass/60 bg-brass-soft" : "border-line hover:border-line-strong hover:bg-surface-muted"
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onToggle(event.target.checked)}
          aria-labelledby={`${id}-name`}
          aria-describedby={`${id}-description ${id}-price`}
          className="mt-0.5 size-4 shrink-0 accent-ink"
        />
        <span className="min-w-0 flex-1">
          <span id={`${id}-name`} className="block text-sm font-medium text-ink">
            {extra.name}
          </span>
          <span id={`${id}-description`} className="mt-0.5 block text-xs leading-relaxed text-ink-faint">
            {extra.description}
          </span>
        </span>
        <span id={`${id}-price`} className="shrink-0 pt-0.5 text-xs font-medium text-ink-soft tabular-nums">
          <span aria-hidden="true">+{formatPrice(added)}</span>
          <span className="sr-only">{added > 0 ? `Adds ${formatPrice(added)} to your price` : "Doesn't change your price"}</span>
        </span>
      </label>
    </li>
  );
}

/** The rules engine's word on the extras, with its fixes, right where they were chosen. */
function ExtrasProblems({ issues, onApplyFix }: { issues: Issue[]; onApplyFix: (fix: SuggestedFix) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue, index) => {
        const error = issue.severity === "error";
        const Icon = error ? CrossIcon : AlertIcon;
        return (
          <li
            key={`${issue.ruleId}-${index}`}
            className={`rounded-lg border px-3 py-2.5 ${error ? "border-danger/20 bg-danger-soft/40" : "border-warn/25 bg-warn-soft/60"}`}
          >
            <p className="flex gap-2 text-sm leading-relaxed text-ink">
              <Icon className={`mt-0.5 size-4 shrink-0 ${error ? "text-danger" : "text-warn"}`} />
              <span>{issue.message}</span>
            </p>
            {issue.fixes.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5 pl-6">
                {issue.fixes.slice(0, PANEL_FIXES).map((fix) => (
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
          </li>
        );
      })}
    </ul>
  );
}
