"use client";

import { useMemo, useState } from "react";
import { resolveSpec } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { validateSpec } from "@/domain/rules";
import type { SlotKey, WatchSpec } from "@/domain/types";
import { CrossIcon, UndoIcon } from "../ui/icons";
import { eyebrowClass } from "../ui/styles";
import { DesignerChat } from "./DesignerChat";
import { FeasibilityPanel } from "./FeasibilityPanel";
import { OrderPanel } from "./OrderPanel";
import { PartPickers, pickerId, pickerToggleId } from "./PartPickers";
import { PersonalizationPanel } from "./PersonalizationPanel";
import { PreviewStage } from "./PreviewStage";
import { PricePanel } from "./PricePanel";
import { useDesign } from "./useDesign";

/** A sweeping change (template, reset, AI proposal, automatic repair) the customer can take back. */
interface UndoEntry {
  label: string;
  previous: WatchSpec;
  next: WatchSpec;
}

/**
 * The configurator. Everything that judges the design (rules, price, part options) runs right here
 * in the browser on each change; only the AI designer and placing an order go to the server.
 */
export function Configurator({ sharedSpec }: { sharedSpec: WatchSpec | null }) {
  const [spec, setSpec] = useDesign(sharedSpec);
  const parts = useMemo(() => resolveSpec(spec), [spec]);
  const report = useMemo(() => validateSpec(spec), [spec]);
  const quote = useMemo(() => priceSpec(spec), [spec]);
  const [expandedSlots, setExpandedSlots] = useState<SlotKey[]>([]);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const undoable = undo?.next === spec ? undo : null;

  function replaceDesign(next: WatchSpec, label: string) {
    setUndo({ label, previous: spec, next });
    setSpec(next);
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

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-12 sm:px-6 lg:pt-12 xl:max-w-[1440px]">
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

      <div className="mt-8 flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(340px,400px)] xl:items-start">
        <DesignerChat
          spec={spec}
          onDesign={(response) => replaceDesign(response.spec, "Applied the designer's proposal.")}
          className="order-2 xl:sticky xl:top-6 xl:order-none xl:max-h-[calc(100vh-3rem)]"
        />

        <div className="contents xl:flex xl:flex-col xl:gap-6">
          <div className="order-1 xl:order-none">
            <PreviewStage spec={spec} parts={parts} report={report} onChange={setSpec} onReplace={replaceDesign} />
          </div>
          <div className="order-4 flex flex-col gap-6 xl:order-none">
            <FeasibilityPanel
              spec={spec}
              report={report}
              onChange={setSpec}
              onReplace={replaceDesign}
              onRevealSlot={revealSlot}
            />
            <PricePanel quote={quote} />
            <OrderPanel spec={spec} report={report} quote={quote} />
          </div>
        </div>

        <section aria-labelledby="parts-title" className="order-3 flex flex-col gap-3 xl:order-none">
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
            quote={quote}
            expandedSlots={expandedSlots}
            onToggleSlot={toggleSlot}
            onChoose={(slot, partId) => setSpec({ ...spec, [slot]: partId })}
          />
          <PersonalizationPanel
            personalization={spec.personalization}
            parts={parts}
            report={report}
            onChange={(personalization) => setSpec({ ...spec, personalization })}
          />
        </section>
      </div>

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 print:hidden"
      >
        {undoable && (
          <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-sm text-paper shadow-lg">
            <span className="min-w-0 truncate">{undoable.label}</span>
            <button
              type="button"
              onClick={() => setSpec(undoable.previous)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper/15 px-3 py-1 font-medium hover:bg-paper/25"
            >
              <UndoIcon />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setUndo(null)}
              aria-label="Dismiss"
              className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-paper/15"
            >
              <CrossIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
