"use client";

import { type BenchList, benchStorageKey, toggleTick, useTicks } from "./benchTicks";

export interface ChecklistItem {
  id: string;
  label: string;
  detail?: string;
}

interface ChecklistProps {
  items: ChecklistItem[];
  label: string;
  /** Whose build sheet, and which of its lists: where this browser keeps the ticks. */
  orderId: string;
  list: BenchList;
  /** Flow short items into two columns on wider screens. */
  columns?: boolean;
  /** A line to write a measurement on, on paper. */
  printResultLine?: boolean;
}

/** Tick-off list for the bench, remembered in this browser. */
export function Checklist({ items, label, orderId, list, columns = false, printResultLine = false }: ChecklistProps) {
  const storageKey = benchStorageKey(orderId, list);
  const checked = useTicks(storageKey);
  const done = items.filter((item) => checked.has(item.id)).length;

  return (
    <div>
      <p className="text-xs text-ink-faint print:hidden">
        {done} of {items.length} checked
      </p>
      <ul aria-label={label} className={`mt-2 ${columns ? "gap-x-6 sm:columns-2" : ""}`}>
        {items.map((item) => {
          const ticked = checked.has(item.id);
          return (
            <li key={item.id} className="mb-1 break-inside-avoid">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-muted">
                <input
                  type="checkbox"
                  checked={ticked}
                  onChange={() => toggleTick(storageKey, item.id)}
                  className="mt-0.5 size-4 shrink-0 accent-ok"
                />
                <span className="min-w-0">
                  <span className={`text-sm ${ticked ? "text-ink-faint line-through" : "text-ink"}`}>{item.label}</span>
                  {item.detail && <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{item.detail}</span>}
                  {printResultLine && (
                    <span aria-hidden="true" className="mt-2 hidden text-xs text-ink-soft print:block">
                      Result: ____________________________________________
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
