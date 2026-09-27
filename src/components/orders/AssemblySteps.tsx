"use client";

import type { BuildStep } from "@/domain/types";
import { AlertIcon, CheckIcon } from "../ui/icons";
import { benchStorageKey, toggleTick, useTicks } from "./benchTicks";

/** A step this long runs over a page break rather than leaving most of a page blank. */
const KEEP_TOGETHER_MAX_WORDS = 120;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

/** The assembly steps, each with a tick box for the bench, remembered in this browser. */
export function AssemblySteps({ steps, orderId }: { steps: BuildStep[]; orderId: string }) {
  const storageKey = benchStorageKey(orderId, "steps");
  const done = useTicks(storageKey);
  const doneCount = steps.filter((_, index) => done.has(`step-${index + 1}`)).length;

  return (
    <>
      <p className="mt-1 text-xs text-ink-faint print:hidden" aria-live="polite">
        {doneCount} of {steps.length} steps done
      </p>
      <ol className="mt-4 flex flex-col gap-5">
        {steps.map((step, index) => {
          const id = `step-${index + 1}`;
          const ticked = done.has(id);
          const long = wordCount(step.detail) > KEEP_TOGETHER_MAX_WORDS;
          return (
            <li key={index} className={`flex gap-4 ${long ? "" : "break-inside-avoid"}`}>
              <span
                aria-hidden="true"
                className={`flex size-9 shrink-0 items-center justify-center rounded-full border font-display text-lg font-semibold ${
                  ticked ? "border-ok bg-ok text-paper" : "border-brass/60 text-brass-ink"
                }`}
              >
                {ticked ? <CheckIcon className="size-5" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <label className="flex max-w-prose cursor-pointer items-start justify-between gap-3 break-after-avoid">
                  <span className={`font-semibold ${ticked ? "text-ink-faint" : "text-ink"}`}>
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-ink-faint">
                    <span className="print:hidden">Done</span>
                    <input
                      type="checkbox"
                      checked={ticked}
                      onChange={() => toggleTick(storageKey, id)}
                      className="size-5 accent-ok"
                    />
                  </span>
                </label>
                <p className={`mt-1 max-w-prose leading-relaxed ${ticked ? "text-ink-faint" : "text-ink-soft"}`}>{step.detail}</p>
                {step.cautions.length > 0 && (
                  <ul className="mt-2 flex max-w-prose flex-col gap-1.5 rounded-lg border border-warn/25 bg-warn-soft/60 p-3 print:rounded-none print:border-y-0 print:border-r-0 print:border-l-4 print:border-l-warn print:bg-transparent print:py-1">
                    {step.cautions.map((caution, cautionIndex) => (
                      <li key={cautionIndex} className="flex gap-2 text-sm leading-relaxed text-ink">
                        <AlertIcon className="mt-0.5 size-4 shrink-0 text-warn" />
                        <span>
                          <span className="sr-only print:not-sr-only print:font-semibold">Caution: </span>
                          {caution}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
