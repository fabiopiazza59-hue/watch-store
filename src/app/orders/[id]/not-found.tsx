import type { Metadata } from "next";
import { NotFoundPanel } from "@/components/site/NotFoundPanel";

export const metadata: Metadata = { title: "Order not found" };

export default function OrderNotFound() {
  return (
    <NotFoundPanel title="We can't find that order" secondary={{ href: "/orders", label: "Workshop queue" }}>
      <p>
        Order numbers look like <span className="font-mono text-sm text-ink">ORD-20260927-4F1C9A0B2D7E6153</span>. Check
        the number, or find the order in the workshop queue.
      </p>
    </NotFoundPanel>
  );
}
