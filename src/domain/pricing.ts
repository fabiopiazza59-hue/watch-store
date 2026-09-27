// Cost breakdown, suggested retail price and lead time for one watch. Part costs live in the
// catalogue; everything else the workshop spends per watch is set in PRICING_CONFIG.
import { estimateBenchMinutes, partsBySlot, PERSONALIZATION_SERVICES, requestedPersonalization } from "./buildSheet";
import { CATALOG, resolveSpec } from "./catalog";
import type { Catalog, PriceLine, PriceQuote, WatchSpec } from "./types";

/** Per-watch costs and pricing policy. All money is EUR excluding VAT. */
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
    /** Each watch's share of inbound shipping and import costs for its parts. */
    inboundShippingEur: 6,
    /** Set aside for warranty repairs, as a percentage of the parts cost. */
    warrantyReservePctOfParts: 5,
  },
  /** Gross margin the suggested retail price aims for before charm rounding. */
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

/** Cost breakdown, suggested retail price and lead time for one unit. Pure; unknown parts add nothing. */
export function priceSpec(spec: WatchSpec, catalog: Catalog = CATALOG): PriceQuote {
  const { labourRateEurPerHour, qcEur, overhead, targetGrossMarginPct, benchAndQcDays } = PRICING_CONFIG;
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
    { label: "Inbound shipping share", kind: "overhead", cents: toCents(overhead.inboundShippingEur) },
    {
      label: `Warranty reserve: ${overhead.warrantyReservePctOfParts}% of parts`,
      kind: "overhead",
      cents: Math.round((partsCents * overhead.warrantyReservePctOfParts) / 100),
    },
  ];

  const centsOf = (...kinds: PriceLine["kind"][]) => sum(lines.filter((line) => kinds.includes(line.kind)).map((line) => line.cents));
  const totalCents = sum(lines.map((line) => line.cents));
  const suggestedRetailEur = charmPrice(fromCents(totalCents) / (1 - targetGrossMarginPct / 100));
  const marginPct = Math.round(((suggestedRetailEur - fromCents(totalCents)) / suggestedRetailEur) * 1000) / 10;

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
    suggestedRetailEur,
    marginPct,
    leadTimeDays: slowestPartDays + personalizationDays + benchAndQcDays,
  };
}
