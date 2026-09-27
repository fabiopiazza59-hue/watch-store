import type { Extra } from "../types";

/**
 * Add-ons a customer can put in the order. Costs are workshop estimates (EUR, excl. VAT); a spare
 * strap is chosen from the strap catalogue instead, so it is not listed here.
 */
export const EXTRAS: Extra[] = [
  {
    id: "extra-presentation-box",
    name: "Presentation box",
    description: "A cushioned wooden box to keep the watch in, and to hand it over in.",
    kind: "packaging",
    costEur: 12,
    leadTimeDays: 7,
    supplierHint: "Watch-box wholesalers; single-watch wooden or leatherette boxes with a removable cushion.",
    benchMinutes: 0,
  },
  {
    id: "extra-travel-pouch",
    name: "Leather travel pouch",
    description: "A soft leather pouch that protects the watch in a bag or a drawer.",
    kind: "packaging",
    costEur: 8,
    leadTimeDays: 7,
    supplierHint: "Leather-goods suppliers; single-watch zip or snap pouches.",
    benchMinutes: 0,
  },
  {
    id: "extra-spring-bar-tool",
    name: "Spring-bar tool",
    description: "The small forked tool for changing straps yourself, handy with a spare strap.",
    kind: "tool",
    costEur: 4,
    leadTimeDays: 5,
    supplierHint: "Watch-tool suppliers; basic double-ended spring-bar tool.",
    benchMinutes: 0,
  },
  {
    id: "extra-gift-wrap",
    name: "Gift wrapping and card",
    description: "Wrapped by hand, with a handwritten card carrying your message.",
    kind: "gift",
    costEur: 4,
    leadTimeDays: 0,
    supplierHint: "Stationery: wrapping paper, ribbon, blank cards.",
    benchMinutes: 10,
  },
  {
    id: "extra-fine-regulation",
    name: "Fine regulation",
    description:
      "An extra regulation session on the timegrapher, aiming for within ±10 s/day face up (the movement's own spec is −20 to +40).",
    kind: "service",
    costEur: 0,
    leadTimeDays: 0,
    supplierHint: "Bench service: no parts to buy.",
    benchMinutes: 45,
  },
  {
    id: "extra-timing-certificate",
    name: "Timing certificate",
    description: "A signed card with your watch's own timegrapher readings from its final test.",
    kind: "service",
    costEur: 2,
    leadTimeDays: 0,
    supplierHint: "Printed on card stock at the workshop.",
    benchMinutes: 10,
  },
];
