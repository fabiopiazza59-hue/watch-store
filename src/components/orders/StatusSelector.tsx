"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { OrderStatus } from "@/domain/types";
import { ApiError, changeOrderStatus } from "../apiClient";
import { ChevronIcon } from "../ui/icons";
import { isOrderStatus, ORDER_STATUS_LABELS, ORDER_STATUSES } from "./orderStatus";

/** Moves an order along the workshop's workflow. */
export function StatusSelector({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: OrderStatus) {
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      await changeOrderStatus(orderId, next);
      router.refresh();
    } catch (caught) {
      setValue(previous);
      setError(caught instanceof ApiError ? caught.message : "Couldn't update the status. Please try again.");
    } finally {
      setSaving(false);
    }
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
          disabled={saving}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            if (isOrderStatus(event.target.value)) void change(event.target.value);
          }}
          className="h-10 w-full min-w-44 appearance-none rounded-full border border-line-strong bg-surface pr-9 pl-4 text-sm font-medium text-ink disabled:opacity-60"
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
        {saving ? "Saving…" : ""}
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
