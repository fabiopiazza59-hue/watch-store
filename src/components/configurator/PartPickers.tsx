import { useId, useMemo } from "react";
import { findPart, NONE_OPTION_ID, SLOTS } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { evaluateOptions } from "@/domain/rules";
import type { PriceQuote, ResolvedSpec, SlotDef, SlotKey, ValidationReport, WatchSpec } from "@/domain/types";
import { partHighlights, partSwatch } from "../parts/partInfo";
import { PartSwatch, SwatchPlaceholder } from "../parts/PartSwatch";
import { formatPrice, formatPriceDelta } from "../ui/format";
import { AlertIcon, ChevronIcon, CrossIcon } from "../ui/icons";
import { buttonClass } from "../ui/styles";
import { FitBadge } from "./FitBadge";
import { type Attention, fitOf, leadIssue, slotAttention } from "./fit";

export function pickerId(slot: SlotKey): string {
  return `picker-${slot}`;
}

export function pickerToggleId(slot: SlotKey): string {
  return `picker-${slot}-toggle`;
}

interface PartPickersProps {
  spec: WatchSpec;
  parts: ResolvedSpec;
  report: ValidationReport;
  quote: PriceQuote;
  expandedSlots: SlotKey[];
  onToggleSlot: (slot: SlotKey) => void;
  onChoose: (slot: SlotKey, partId: string | null) => void;
}

export function PartPickers({ spec, parts, report, quote, expandedSlots, onToggleSlot, onChoose }: PartPickersProps) {
  const attention = slotAttention(report);
  return (
    <div className="flex flex-col gap-3">
      {SLOTS.map((def) => (
        <PartPicker
          key={def.slot}
          def={def}
          spec={spec}
          parts={parts}
          quote={quote}
          attention={attention[def.slot]}
          expanded={expandedSlots.includes(def.slot)}
          onToggle={() => onToggleSlot(def.slot)}
          onChoose={(partId) => onChoose(def.slot, partId)}
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
  quote: PriceQuote;
  attention?: Attention;
  expanded: boolean;
  onToggle: () => void;
  onChoose: (partId: string | null) => void;
}

function PartPicker({ def, spec, parts, quote, attention, expanded, onToggle, onChoose }: PartPickerProps) {
  const headingId = useId();
  const listId = useId();
  const current = parts[def.category];
  const swatch = current ? partSwatch(current) : null;
  const emptyLabel = def.optional ? `No ${def.label.toLowerCase()}` : "Not chosen yet";

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
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            id={pickerToggleId(def.slot)}
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={onToggle}
            className={buttonClass("secondary", "sm")}
          >
            {expanded ? "Done" : "Change"}
            <span className="sr-only"> {def.label.toLowerCase()}</span>
            <ChevronIcon className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {current && (
            <span className="text-xs text-ink-faint tabular-nums">
              <span className="sr-only">Part cost </span>
              {formatPrice(current.costEur)}
            </span>
          )}
        </div>
      </div>
      {expanded && <OptionList id={listId} def={def} spec={spec} quote={quote} onChoose={onChoose} />}
    </section>
  );
}

interface OptionListProps {
  id: string;
  def: SlotDef;
  spec: WatchSpec;
  quote: PriceQuote;
  onChoose: (partId: string | null) => void;
}

function OptionList({ id, def, spec, quote, onChoose }: OptionListProps) {
  const currentPrice = quote.suggestedRetailEur;
  const options = useMemo(
    () =>
      evaluateOptions(def.slot, spec).map((status) => {
        const partId = status.partId === NONE_OPTION_ID ? null : status.partId;
        const candidate: WatchSpec = { ...spec, [def.slot]: partId };
        return {
          status,
          partId,
          part: findPart(partId),
          fit: fitOf(status),
          reason: leadIssue(status),
          priceDelta: priceSpec(candidate).suggestedRetailEur - currentPrice,
        };
      }),
    [def.slot, spec, currentPrice],
  );
  const selectedId = spec[def.slot] ?? NONE_OPTION_ID;
  const hasSwatches = options.some(({ part }) => part && partSwatch(part));
  const fitting = options.filter((option) => option.fit !== "wont-fit").length;

  return (
    <fieldset id={id} className="border-t border-line px-2 pt-2 pb-2">
      <legend className="sr-only">Choose the {def.label.toLowerCase()}</legend>
      <p className="px-2 pt-1 pb-2 text-xs text-ink-faint">
        {fitting} of {options.length} fit the rest of this design. Parts that won&rsquo;t fit stay selectable, so you
        can see why.
      </p>
      <ul className="flex flex-col gap-1">
        {options.map(({ status, partId, part, fit, reason, priceDelta }) => {
          const selected = status.partId === selectedId;
          const reasonId = `${id}-${status.partId}-reason`;
          const swatch = part ? partSwatch(part) : null;
          return (
            <li key={status.partId}>
              <label
                className={`group flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-brass-ink ${
                  selected ? "border-brass/60 bg-brass-soft" : "border-transparent hover:bg-surface-muted"
                }`}
              >
                <input
                  type="radio"
                  name={`option-${def.slot}`}
                  value={status.partId}
                  checked={selected}
                  onChange={() => onChoose(partId)}
                  aria-describedby={reason ? reasonId : undefined}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`mt-1 size-4 shrink-0 rounded-full border ${
                    selected ? "border-[5px] border-ink bg-surface" : "border-line-strong bg-surface"
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
                    <span className={`text-sm font-medium ${fit === "wont-fit" ? "text-ink-soft" : "text-ink"}`}>
                      {part?.name ?? `No ${def.label.toLowerCase()}`}
                    </span>
                    <FitBadge fit={fit} />
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {part ? partHighlights(part).join(" · ") : "Leave this out"}
                  </span>
                  {reason && (
                    <span
                      id={reasonId}
                      className={`mt-1 line-clamp-2 text-xs leading-relaxed group-hover:line-clamp-none group-has-focus-visible:line-clamp-none ${
                        reason.severity === "error" ? "text-danger" : "text-warn"
                      }`}
                    >
                      {reason.message}
                    </span>
                  )}
                </span>
                <span className="shrink-0 pt-0.5 text-xs text-ink-soft tabular-nums">
                  {selected ? (
                    "Chosen"
                  ) : (
                    <>
                      <span className="sr-only">Price change </span>
                      {formatPriceDelta(priceDelta)}
                    </>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
