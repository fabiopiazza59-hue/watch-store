"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { OrderStatus } from "@/domain/types";
import { ApiError, changeOrderStatus } from "../apiClient";
import { ChevronIcon } from "../ui/icons";
import { isOrderStatus, ORDER_STATUS_LABELS, ORDER_STATUSES } from "./orderStatus";

/**
 * A choice is saved once the select loses focus, Enter is pressed, or it has rested this long:
 * on Windows and Linux, arrow keys step a closed select through every status in between.
 */
const SAVE_AFTER_MS = 800;
const MESSAGE_MS = 2500;

/** Moves an order along the workshop's workflow. */
export function StatusSelector({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The status the server has, the one chosen, and whether a save is running (one at a time). */
  const saved = useRef(status);
  const wanted = useRef(status);
  const inFlight = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!message) return;
    const clear = window.setTimeout(() => setMessage(""), MESSAGE_MS);
    return () => window.clearTimeout(clear);
  }, [message]);

  function revert() {
    wanted.current = saved.current;
    setValue(saved.current);
  }

  /** Saves the chosen status, then any status chosen while that save ran. */
  async function save() {
    window.clearTimeout(timer.current);
    if (inFlight.current) return;
    inFlight.current = true;
    let changed = false;
    try {
      while (wanted.current !== saved.current) {
        const next = wanted.current;
        if (next === "cancelled" && !window.confirm("Cancel this order? The customer's watch won't be built.")) {
          revert();
          break;
        }
        setSaving(true);
        setError(null);
        try {
          await changeOrderStatus(orderId, next);
          saved.current = next;
          changed = true;
          setMessage(`Status updated to ${ORDER_STATUS_LABELS[next]}.`);
        } catch (caught) {
          revert();
          setError(caught instanceof ApiError ? caught.message : "Couldn't update the status. Please try again.");
          break;
        }
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
    if (changed) router.refresh();
  }

  function choose(next: OrderStatus) {
    setValue(next);
    wanted.current = next;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), SAVE_AFTER_MS);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
        Status
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          aria-busy={saving}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            if (isOrderStatus(event.target.value)) choose(event.target.value);
          }}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
          }}
          className="h-10 w-full min-w-44 appearance-none rounded-full border border-control-border bg-surface pr-9 pl-4 text-sm font-medium text-ink"
        >
          {ORDER_STATUSES.map((option) => (
            <option key={option} value={option}>
              {ORDER_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        <ChevronIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-faint" />
      </div>
      <p role="status" className="min-h-4 text-xs text-ink-faint">
        {saving ? "Saving…" : message}
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
