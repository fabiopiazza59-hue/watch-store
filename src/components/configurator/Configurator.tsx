"use client";

import { useEffect, useMemo, useState } from "react";
import { getSlotDef, resolveSpec } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { repairKeeping, repairSpec, validateSpec } from "@/domain/rules";
import type { PriceQuote, ResolvedSpec, SlotKey, SuggestedFix, ValidationReport, WatchSpec } from "@/domain/types";
import { WatchPreview } from "../preview/WatchPreview";
import { formatPrice, plural, vatNote } from "../ui/format";
import { CrossIcon, UndoIcon } from "../ui/icons";
import { eyebrowClass } from "../ui/styles";
import { DesignerChat } from "./DesignerChat";
import { EXTRAS_PANEL_ID, EXTRAS_TITLE_ID, ExtrasPanel } from "./ExtrasPanel";
import { FeasibilityPanel, type RepairOutcome } from "./FeasibilityPanel";
import { OrderPanel } from "./OrderPanel";
import { PartPickers, pickerId, pickerToggleId } from "./PartPickers";
import { PersonalizationPanel } from "./PersonalizationPanel";
import { PREVIEW_DRAWING_ID, PREVIEW_ID, PreviewStage, VerdictChip } from "./PreviewStage";
import { PricePanel } from "./PricePanel";
import { useDesign } from "./useDesign";

/** A sweeping change (template, reset, AI proposal, automatic repair) the customer can take back. */
interface UndoEntry {
  label: string;
  previous: WatchSpec;
  next: WatchSpec;
}

/** How long the Undo toast stays, unless it is hovered or focused. Undo stays available inline. */
const UNDO_TOAST_MS = 10_000;

/**
 * The configurator. Everything that judges the design (rules, price, part options) runs right here
 * in the browser on each change; only the AI designer and placing an order go to the server.
 */
export function Configurator({ sharedSpec }: { sharedSpec: WatchSpec | null }) {
  const [spec, setSpec, getSpec] = useDesign(sharedSpec);
  const parts = useMemo(() => resolveSpec(spec), [spec]);
  const report = useMemo(() => validateSpec(spec), [spec]);
  const quote = useMemo(() => priceSpec(spec), [spec]);
  const [expandedSlots, setExpandedSlots] = useState<SlotKey[]>([]);
  /** The slot the customer last chose a part for: automatic repairs try to keep that part. */
  const [lastChangedSlot, setLastChangedSlot] = useState<SlotKey | null>(null);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const [toastShown, setToastShown] = useState(false);
  const [toastHeld, setToastHeld] = useState({ hover: false, focus: false });
  const previewInView = useInView(PREVIEW_DRAWING_ID);
  const undoable = undo?.next === spec ? undo : null;
  const toast = toastShown ? undoable : null;

  useEffect(() => {
    if (!toast || toastHeld.hover || toastHeld.focus) return;
    const timer = window.setTimeout(() => setToastShown(false), UNDO_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast, toastHeld]);

  /**
   * Replaces the whole design, remembering the design as it is now (not as it was when this render
   * happened: a designer proposal can arrive long after the customer's last edit).
   */
  function replaceDesign(next: WatchSpec, label: string, changedSlot: SlotKey | null = null) {
    setUndo({ label, previous: getSpec(), next });
    setToastShown(true);
    // A toast that was closed while hovered or focused never saw the pointer or focus leave.
    setToastHeld({ hover: false, focus: false });
    setLastChangedSlot(changedSlot);
    setSpec(next);
  }

  function undoLast() {
    if (!undoable) return;
    setSpec(undoable.previous);
    setToastShown(false);
  }

  function applyFix(fix: SuggestedFix) {
    setSpec({ ...spec, ...fix.patch });
  }

  /** The part chosen last, as "Field Olive dial", when the current design still has it. */
  function lastChoiceName(): string | null {
    if (!lastChangedSlot) return null;
    const def = getSlotDef(lastChangedSlot);
    const part = parts[def.category];
    return part ? `${part.name} ${def.label.toLowerCase()}` : null;
  }

  /** "Fix everything": keeps the part chosen last when the design can be built around it. */
  function repairDesign(): RepairOutcome {
    const kept = lastChangedSlot ? repairKeeping(spec, [lastChangedSlot]) : null;
    const involved = report.issues.some(
      (issue) => issue.severity === "error" && lastChangedSlot !== null && issue.slots.includes(lastChangedSlot),
    );
    const keptPart = kept?.report.buildable && involved ? lastChoiceName() : null;
    const result = kept?.report.buildable ? kept : repairSpec(spec);
    if (result.changes.length > 0) {
      const label = keptPart ? `Fixed the design around your ${keptPart}.` : "Applied automatic fixes.";
      replaceDesign(result.spec, label, result === kept ? lastChangedSlot : null);
    }
    return { result, keptPart };
  }

  /** Fixes the rest of the design around the part chosen last; false, changing nothing, when nothing fits around it. */
  function keepLastChoice(): boolean {
    const name = lastChoiceName();
    if (!lastChangedSlot || !name) return false;
    const result = repairKeeping(spec, [lastChangedSlot]);
    if (!result.report.buildable) return false;
    const label = `Kept your ${name} and changed ${plural(result.changes.length, "other part")}.`;
    replaceDesign(result.spec, label, lastChangedSlot);
    return true;
  }

  function toggleSlot(slot: SlotKey) {
    setExpandedSlots((current) =>
      current.includes(slot) ? current.filter((open) => open !== slot) : [...current, slot],
    );
  }

  /** Open a part picker and bring it into view, e.g. from an issue that involves that part. */
  function revealSlot(slot: SlotKey) {
    setExpandedSlots((current) => (current.includes(slot) ? current : [...current, slot]));
    document.getElementById(pickerId(slot))?.scrollIntoView({ block: "start" });
    document.getElementById(pickerToggleId(slot))?.focus({ preventScroll: true });
  }

  /** Bring the extras into view, e.g. from an issue about the spare strap. */
  function revealExtras() {
    document.getElementById(EXTRAS_PANEL_ID)?.scrollIntoView({ block: "start" });
    document.getElementById(EXTRAS_TITLE_ID)?.focus({ preventScroll: true });
  }

  return (
    // Below xl, room at the bottom for the summary bar and the Undo toast.
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-28 sm:px-6 lg:pt-12 xl:max-w-[1440px] xl:pb-12">
      <header className="max-w-2xl">
        <p className={eyebrowClass}>Configurator</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Design your watch
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          Start from one of our designs, describe your idea to the designer, or choose every part yourself. We&rsquo;ll
          tell you honestly whether it can be built, and why.
        </p>
      </header>

      {/*
        Below xl everything is one column: the watch, whether it can be built, the designer, the parts,
        then the price and order. From xl, three columns: designer | watch, verdict, price | parts.
      */}
      <div className="mt-8 flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(340px,400px)] xl:items-start">
        <DesignerChat
          spec={spec}
          onApply={(proposal) => replaceDesign(proposal, "Applied the designer's proposal.")}
          undoableSpec={undoable?.next ?? null}
          onUndo={undoLast}
          className="order-3 xl:sticky xl:top-6 xl:order-none xl:max-h-[calc(100vh-3rem)]"
        />

        <div className="contents xl:flex xl:flex-col xl:gap-6">
          <div className="order-1 xl:order-none">
            <PreviewStage
              spec={spec}
              parts={parts}
              report={report}
              quote={quote}
              onChange={setSpec}
              onReplace={replaceDesign}
            />
          </div>
          <div className="order-2 xl:order-none">
            <FeasibilityPanel
              spec={spec}
              report={report}
              onChange={setSpec}
              onRepair={repairDesign}
              undoableSpec={undoable?.next ?? null}
              onUndo={undoLast}
              onRevealSlot={revealSlot}
              onRevealExtras={revealExtras}
            />
          </div>
          <div className="order-5 flex flex-col gap-6 xl:order-none">
            <PricePanel quote={quote} />
            <OrderPanel spec={spec} parts={parts} report={report} quote={quote} />
          </div>
        </div>

        <section aria-labelledby="parts-title" className="order-4 flex flex-col gap-3 xl:order-none">
          <div>
            <h2 id="parts-title" className="font-display text-xl font-semibold text-ink">
              Choose every part
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Each option shows whether it fits the rest of your design, and how it moves the price.
            </p>
          </div>
          <PartPickers
            spec={spec}
            parts={parts}
            report={report}
            expandedSlots={expandedSlots}
            lastChangedSlot={lastChangedSlot}
            onToggleSlot={toggleSlot}
            onChoose={(slot, partId) => {
              setLastChangedSlot(slot);
              setSpec({ ...spec, [slot]: partId });
            }}
            onReplace={replaceDesign}
            onApplyFix={applyFix}
            onKeepChoice={keepLastChoice}
          />
          <PersonalizationPanel
            personalization={spec.personalization}
            parts={parts}
            report={report}
            onChange={(personalization) => setSpec({ ...spec, personalization })}
          />
          <ExtrasPanel
            spec={spec}
            parts={parts}
            report={report}
            onChange={(extras) => setSpec({ ...spec, extras })}
            onApplyFix={applyFix}
          />
        </section>
      </div>

      {!previewInView && <SummaryBar spec={spec} parts={parts} report={report} quote={quote} />}

      <div
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4 print:hidden xl:bottom-4 ${
          previewInView ? "bottom-4" : "bottom-[calc(env(safe-area-inset-bottom)+5rem)]"
        }`}
      >
        {toast && (
          <div
            onPointerEnter={() => setToastHeld((held) => ({ ...held, hover: true }))}
            onPointerLeave={() => setToastHeld((held) => ({ ...held, hover: false }))}
            onFocus={() => setToastHeld((held) => ({ ...held, focus: true }))}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setToastHeld((held) => ({ ...held, focus: false }));
            }}
            className="undo-toast pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-sm text-paper shadow-lg"
          >
            <span className="min-w-0 truncate">{toast.label}</span>
            <button
              type="button"
              onClick={undoLast}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-paper/15 px-3 py-1 font-medium hover:bg-paper/25"
            >
              <UndoIcon />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setToastShown(false)}
              aria-label="Dismiss"
              className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-paper/15"
            >
              <CrossIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface SummaryBarProps {
  spec: WatchSpec;
  parts: ResolvedSpec;
  report: ValidationReport;
  quote: PriceQuote;
}

/**
 * Below xl, once the watch has scrolled out of view: a thumbnail of it, the verdict and the price,
 * so choosing parts further down the page still shows what they do.
 */
function SummaryBar({ spec, parts, report, quote }: SummaryBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden xl:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2 sm:px-6">
        <a href={`#${PREVIEW_ID}`} aria-label="See your watch" className="size-12 shrink-0 rounded-full">
          <WatchPreview parts={parts} personalization={spec.personalization} size={48} className="size-12" />
        </a>
        <VerdictChip report={report} />
        <p className="ml-auto text-right leading-tight">
          <span className="block font-display text-lg font-semibold text-ink tabular-nums">
            {formatPrice(quote.retailInclVatEur)}
          </span>
          <span className="text-xs text-ink-faint">{vatNote(quote)}</span>
        </p>
      </div>
    </div>
  );
}

/** Whether a quarter or more of the element with this id is on screen; true until it is known. */
function useInView(id: string): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const target = document.getElementById(id);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= 0.25), {
      threshold: [0, 0.25],
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [id]);
  return inView;
}
