"use client";

import { useState } from "react";

export interface ChecklistItem {
  id: string;
  label: string;
  detail?: string;
}

interface ChecklistProps {
  items: ChecklistItem[];
  label: string;
  /** Flow short items into two columns on wider screens. */
  columns?: boolean;
}

/** Tick-off list for the bench. State lives only in this page view; nothing is saved. */
export function Checklist({ items, label, columns = false }: ChecklistProps) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <p className="text-xs text-ink-faint print:hidden">
        {checked.size} of {items.length} checked
      </p>
      <ul aria-label={label} className={`mt-2 ${columns ? "gap-x-6 sm:columns-2" : ""}`}>
        {items.map((item) => {
          const done = checked.has(item.id);
          return (
            <li key={item.id} className="mb-1 break-inside-avoid">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-muted">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 size-4 shrink-0 accent-ok"
                />
                <span className="min-w-0">
                  <span className={`text-sm ${done ? "text-ink-faint line-through" : "text-ink"}`}>{item.label}</span>
                  {item.detail && <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{item.detail}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
