// Display formatting shared by the configurator and the workshop pages.
import type { PriceQuote } from "@/domain/types";

const wholeEuros = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const euros = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const millimetres = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

const percent = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/** "€539" for prices customers see. */
export function formatPrice(amountEur: number): string {
  return wholeEuros.format(amountEur);
}

/**
 * What a price includes: "incl. 20% VAT"; "no VAT charged" for a VAT-exempt business; "excl. VAT"
 * for an order quoted before VAT was itemised, whose price didn't include it.
 */
export function vatNote(quote: Pick<PriceQuote, "vatRatePct" | "quotedExclVat">): string {
  if (quote.quotedExclVat) return "excl. VAT";
  return quote.vatRatePct > 0 ? `incl. ${percent.format(quote.vatRatePct)}% VAT` : "no VAT charged";
}

/** "€9.90" for cost lines, where cents matter. */
export function formatCost(amountEur: number): string {
  return euros.format(amountEur);
}

/** "+€30", "−€10" or "±€0": how a choice moves the price. */
export function formatPriceDelta(deltaEur: number): string {
  const rounded = Math.round(deltaEur);
  if (rounded === 0) return "±€0";
  return `${rounded > 0 ? "+" : "−"}${wholeEuros.format(Math.abs(rounded))}`;
}

/** "28.5 mm". */
export function formatMm(value: number): string {
  return `${millimetres.format(value)} mm`;
}

/** "27 Sept 2026, 14:05". */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** "27 Sept 2026". */
export function formatDate(value: string | Date): string {
  return date.format(typeof value === "string" ? new Date(value) : value);
}

/**
 * A mailto: link for an address as stored. Everything but its "@" is percent-encoded, so an address
 * carrying "?cc=" or "&body=" can't add recipients or prefill the message.
 */
export function mailtoHref(email: string): string {
  return `mailto:${encodeURIComponent(email.trim()).replace("%40", "@")}`;
}

/** "2 h 20 min" or "45 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "sapphire, domed" → "Sapphire, domed". */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "1 issue", "3 issues". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
