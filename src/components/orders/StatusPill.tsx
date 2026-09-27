import type { OrderStatus } from "@/domain/types";
import { ORDER_STATUS_LABELS } from "./orderStatus";

const STATUS_STYLES: Record<OrderStatus, { pill: string; dot: string }> = {
  received: { pill: "bg-info-soft text-info", dot: "bg-info" },
  "parts-ordered": { pill: "bg-brass-soft text-brass-ink", dot: "bg-brass" },
  assembling: { pill: "bg-warn-soft text-warn", dot: "bg-warn" },
  qc: { pill: "bg-warn-soft text-warn", dot: "bg-warn" },
  shipped: { pill: "bg-ok-soft text-ok", dot: "bg-ok" },
  cancelled: { pill: "bg-surface-muted text-ink-faint", dot: "bg-ink-faint" },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const { pill, dot } = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${pill}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
