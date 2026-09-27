// Cost breakdown, consumer price and lead time for one watch. Part costs live in the catalogue;
// everything else the workshop spends per watch is set in PRICING_CONFIG.
import { estimateBenchMinutes, partsBySlot, PERSONALIZATION_SERVICES, requestedPersonalization } from "./buildSheet";
import { CATALOG, resolveSpec } from "./catalog";
import type { Catalog, PriceLine, PriceQuote, WatchSpec } from "./types";

/** Per-watch costs and pricing policy. All money is EUR excluding VAT unless a name says otherwise. */
export const PRICING_CONFIG = {
  /**
   * Bought-in dial printing and caseback engraving, per unit. Their costs and lead times are
   * defined next to the build steps they add, in buildSheet.ts.
   */
  personalization: PERSONALIZATION_SERVICES,
  /** Charged on the bench-minute estimate shared with the build sheet (`estimateBenchMinutes`). */
  labourRateEurPerHour: 36,
  /** Timegrapher regulation and pressure test, per watch. Counted as labour in the totals. */
  qcEur: 10,
  overhead: {
    packagingEur: 9,
    /**
     * Inbound shipping and import handling per part, as a first approximation that each part of a one-off
     * build arrives as its own parcel from a different shop. Revisit it once real supplier invoices exist.
     */
    inboundShippingEurPerPart: 4,
    /** Insured, tracked shipping to the customer. */
    outboundShippingEur: 12,
    /** A spare stem (Seiko 351-200) while learning, gaskets, thread-locker and grease. */
    consumablesEur: 6,
    /** Set aside for warranty repairs, as a percentage of the parts cost. */
    warrantyReservePctOfParts: 5,
    /** Card or PayPal processing, as a percentage of the VAT-inclusive price the customer pays. */
    paymentFeePct: 2.5,
  },
  /**
   * VAT included in the consumer price, percent: EU consumer prices must include VAT (Directive 98/6/EC).
   * A placeholder for the workshop's home-country standard rate; 0 for a VAT-exempt small business.
   * Destination-country rates for cross-border EU sales (OSS) are not modelled yet.
   */
  vatRatePct: 20,
  /** Gross margin on the price excluding VAT, after every cost, that pricing aims for before charm rounding. */
  targetGrossMarginPct: 45,
  /** Assembly, regulation, 24-hour run-in and pressure test once every part is in. */
  benchAndQcDays: 3,
} as const;

const toCents = (eur: number) => Math.round(eur * 100);
const fromCents = (cents: number) => cents / 100;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Round a price up to the next whole euro amount ending in 9 (347.20 → 349, 349 → 349, 350 → 359).
 * Amounts are rounded to cents first so float noise can't push an exact 349 up to 359.
 */
export function charmPrice(amountEur: number): number {
  const wholeEuros = Math.ceil(fromCents(toCents(amountEur)));
  return Math.ceil((wholeEuros - 9) / 10) * 10 + 9;
}

interface CentLine {
  label: string;
  kind: PriceLine["kind"];
  cents: number;
}

/**
 * Cost breakdown, consumer price and lead time for one unit. Pure; unknown parts add nothing.
 *
 * The consumer price includes VAT and ends in 9. It is the smallest such price whose share excluding VAT
 * keeps the target margin after every cost, the payment fee included (charged on the price paid).
 */
export function priceSpec(spec: WatchSpec, catalog: Catalog = CATALOG): PriceQuote {
  const { labourRateEurPerHour, qcEur, overhead, vatRatePct, targetGrossMarginPct, benchAndQcDays } = PRICING_CONFIG;
  const parts = partsBySlot(spec, catalog).flatMap(({ def, part }) => (part ? [{ label: def.label, part }] : []));
  const services = requestedPersonalization(spec.personalization);
  const benchMinutes = estimateBenchMinutes(resolveSpec(spec, catalog), spec.personalization);
  const partsCents = sum(parts.map(({ part }) => toCents(part.costEur)));

  // Money is kept in whole cents so the lines add up to the totals exactly.
  const lines: CentLine[] = [
    ...parts.map(({ label, part }): CentLine => ({ label: `${label}: ${part.name}`, kind: "part", cents: toCents(part.costEur) })),
    ...services.map((service): CentLine => ({
      label: `${service.label}: "${service.text}"`,
      kind: "personalization",
      cents: toCents(service.costEur),
    })),
    {
      label: `Assembly labour: ${benchMinutes} min at €${labourRateEurPerHour}/h`,
      kind: "labour",
      cents: toCents((benchMinutes / 60) * labourRateEurPerHour),
    },
    { label: "QC: timegrapher regulation and pressure test", kind: "qc", cents: toCents(qcEur) },
    { label: "Packaging", kind: "overhead", cents: toCents(overhead.packagingEur) },
    {
      label: `Inbound shipping: ${parts.length} part ${parts.length === 1 ? "parcel" : "parcels"} at €${overhead.inboundShippingEurPerPart}`,
      kind: "overhead",
      cents: parts.length * toCents(overhead.inboundShippingEurPerPart),
    },
    { label: "Insured, tracked shipping to the customer", kind: "overhead", cents: toCents(overhead.outboundShippingEur) },
    { label: "Consumables and a spare stem", kind: "overhead", cents: toCents(overhead.consumablesEur) },
    {
      label: `Warranty reserve: ${overhead.warrantyReservePctOfParts}% of parts`,
      kind: "overhead",
      cents: Math.round((partsCents * overhead.warrantyReservePctOfParts) / 100),
    },
  ];

  // The payment fee grows with the price, so the net price that keeps the target margin is solved for:
  // net - costs - fee% * net * (1 + VAT) = margin% * net.
  const vatFactor = 1 + vatRatePct / 100;
  const feeShare = overhead.paymentFeePct / 100;
  const costsBeforeFee = fromCents(sum(lines.map((line) => line.cents)));
  const netAtTarget = costsBeforeFee / (1 - targetGrossMarginPct / 100 - feeShare * vatFactor);
  const retailInclVatEur = charmPrice(netAtTarget * vatFactor);
  const grossCents = toCents(retailInclVatEur);
  const netCents = Math.round(grossCents / vatFactor);
  lines.push({
    label: `Payment fee: ${overhead.paymentFeePct}% of the price paid`,
    kind: "overhead",
    cents: Math.round(grossCents * feeShare),
  });

  const centsOf = (...kinds: PriceLine["kind"][]) => sum(lines.filter((line) => kinds.includes(line.kind)).map((line) => line.cents));
  const totalCents = sum(lines.map((line) => line.cents));
  const marginPct = Math.round(((netCents - totalCents) / netCents) * 1000) / 10;

  const slowestPartDays = Math.max(0, ...parts.map(({ part }) => part.leadTimeDays));
  // Printing and engraving run in parallel, after their part arrives, which may be the last one in.
  const personalizationDays = Math.max(0, ...services.map((service) => service.leadTimeDays));

  return {
    currency: "EUR",
    lines: lines.map(({ label, kind, cents }) => ({ label, kind, amountEur: fromCents(cents) })),
    partsCostEur: fromCents(centsOf("part")),
    personalizationCostEur: fromCents(centsOf("personalization")),
    labourCostEur: fromCents(centsOf("labour", "qc")),
    overheadCostEur: fromCents(centsOf("overhead")),
    totalCostEur: fromCents(totalCents),
    suggestedRetailEur: fromCents(netCents),
    vatRatePct,
    vatEur: fromCents(grossCents - netCents),
    retailInclVatEur,
    marginPct,
    leadTimeDays: slowestPartDays + personalizationDays + benchAndQcDays,
  };
}
