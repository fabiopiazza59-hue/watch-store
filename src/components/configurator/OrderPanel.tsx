import { useRouter } from "next/navigation";
import { type FormEvent, type Ref, useEffect, useId, useRef, useState } from "react";
import { resolveExtras } from "@/domain/catalog";
import { ORDER_LIMITS } from "@/domain/schemas";
import type { PriceQuote, ResolvedSpec, ValidationReport, WatchSpec } from "@/domain/types";
import { ApiError, placeOrder } from "../apiClient";
import { confirmationHref } from "../orders/links";
import { WatchPreview } from "../preview/WatchPreview";
import { formatPrice, plural, vatNote } from "../ui/format";
import { AlertIcon, CrossIcon } from "../ui/icons";
import { buttonClass, cardClass, inputClass } from "../ui/styles";

interface OrderPanelProps {
  spec: WatchSpec;
  parts: ResolvedSpec;
  report: ValidationReport;
  quote: PriceQuote;
}

export function OrderPanel({ spec, parts, report, quote }: OrderPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const blockedId = useId();

  function openDialog() {
    setOpen(true);
    dialogRef.current?.showModal();
    // The dialog would focus its first control, the close button; the first field is what's wanted.
    nameRef.current?.focus();
  }

  return (
    <section aria-label="Order" className={`${cardClass} p-5 sm:p-6`}>
      <button
        type="button"
        disabled={!report.buildable}
        aria-describedby={report.buildable ? undefined : blockedId}
        onClick={openDialog}
        className={`${buttonClass("primary", "lg")} w-full`}
      >
        Order this watch &middot; {formatPrice(quote.retailInclVatEur)}
      </button>
      {report.buildable ? (
        <p className="mt-3 text-center text-xs leading-relaxed text-ink-faint">
          No payment is taken here. We&rsquo;ll email you to confirm the details before any parts are ordered.
        </p>
      ) : (
        <p id={blockedId} className="mt-3 text-center text-sm leading-relaxed text-ink-soft">
          Resolve the &ldquo;Must change&rdquo; items above to order. We only accept designs the rules engine confirms
          we can build.
        </p>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby="order-dialog-title"
        onClose={() => setOpen(false)}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <OrderForm
          spec={spec}
          parts={parts}
          report={report}
          quote={quote}
          showPreview={open}
          nameRef={nameRef}
          onCancel={() => dialogRef.current?.close()}
        />
      </dialog>
    </section>
  );
}

type FieldErrors = Partial<Record<"name" | "email" | "notes", string>>;

interface OrderFormProps {
  spec: WatchSpec;
  parts: ResolvedSpec;
  report: ValidationReport;
  quote: PriceQuote;
  /** Draw the watch only while the dialog is open, so the closed dialog costs nothing to update. */
  showPreview: boolean;
  nameRef: Ref<HTMLInputElement>;
  onCancel: () => void;
}

function OrderForm({ spec, parts, report, quote, showPreview, nameRef, onCancel }: OrderFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const caveatsId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fieldErrors: FieldErrors = {
    name: error?.fields["customer.name"],
    email: error?.fields["customer.email"],
    notes: error?.fields.notes,
  };
  const blockingIssues = error?.report?.issues.filter((issue) => issue.severity === "error") ?? [];
  const caveats = report.issues.filter((issue) => issue.severity === "warning");

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const order = await placeOrder({
        spec,
        customer: { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") },
        notes: String(form.get("notes") ?? ""),
      });
      router.push(confirmationHref(order.id, order.confirmationToken));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError("Something went wrong. Please try again.", 0));
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="order-dialog-title" className="font-display text-2xl font-semibold">
            Order &ldquo;{spec.name.trim() || "your watch"}&rdquo;
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {formatPrice(quote.retailInclVatEur)} {vatNote(quote)} &middot; ready in about{" "}
            {plural(quote.leadTimeDays, "day")}
          </p>
        </div>
        <button type="button" onClick={onCancel} className={buttonClass("ghost", "sm")} aria-label="Close">
          <CrossIcon />
        </button>
      </div>

      <OrderSummary spec={spec} parts={parts} showPreview={showPreview} />

      {caveats.length > 0 && (
        <div role="group" aria-labelledby={caveatsId} className="rounded-lg border border-warn/25 bg-warn-soft/60 p-3">
          <p id={caveatsId} className="flex items-center gap-2 text-sm font-medium text-ink">
            <AlertIcon className="size-4 text-warn" />
            Before you order
          </p>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-ink-soft">
            {caveats.map((issue, index) => (
              <li key={`${issue.ruleId}-${index}`}>{issue.message}</li>
            ))}
          </ul>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" name="caveats" required className="mt-0.5 size-4 shrink-0 accent-ink" />
            I&rsquo;ve read {caveats.length === 1 ? "this" : "these"} and want the design as it is
          </label>
        </div>
      )}

      <Field
        label="Your name"
        name="name"
        autoComplete="name"
        required
        maxLength={ORDER_LIMITS.nameMaxLength}
        error={fieldErrors.name}
        inputRef={nameRef}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={ORDER_LIMITS.emailMaxLength}
        error={fieldErrors.email}
      />
      <Field
        label="Notes for the watchmaker"
        name="notes"
        multiline
        maxLength={ORDER_LIMITS.notesMaxLength}
        hint="Optional: wrist size, a date you need it by, anything we should know."
        error={fieldErrors.notes}
      />

      {error && (
        <div role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          <p>{error.message}</p>
          {blockingIssues.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-ink-soft">
              {blockingIssues.map((issue, index) => (
                <li key={`${issue.ruleId}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={buttonClass("secondary", "md")}>
          Keep designing
        </button>
        <button type="submit" disabled={submitting} className={buttonClass("primary", "md")}>
          {submitting ? "Placing your order…" : "Place order"}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">
        No payment is taken on this site. The design is checked once more by the rules engine when you place the
        order, then it goes to the workshop with its build sheet.
      </p>
    </form>
  );
}

/** What is being ordered, at a glance: the watch, its main parts, any personal text and the extras. */
function OrderSummary({ spec, parts, showPreview }: { spec: WatchSpec; parts: ResolvedSpec; showPreview: boolean }) {
  const { dialText, casebackEngraving } = spec.personalization;
  const extras = resolveExtras(spec);
  const rows = [
    { label: "Case", value: parts.case?.name },
    { label: "Dial", value: parts.dial?.name },
    { label: "Strap", value: parts.strap?.name },
    { label: "Dial text", value: dialText.trim() && `“${dialText.trim()}”` },
    { label: "Engraving", value: casebackEngraving.trim() && `“${casebackEngraving.trim()}”` },
    { label: "Spare strap", value: extras.spareStrap?.name },
    // Several names, so this one wraps rather than being cut short.
    { label: "Add-ons", value: extras.items.map((item) => item.name).join(", "), wrap: true },
  ].filter((row): row is { label: string; value: string; wrap?: boolean } => Boolean(row.value));

  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface-muted p-3">
      <div className="size-16 shrink-0">
        {showPreview && (
          <WatchPreview parts={parts} personalization={spec.personalization} size={64} className="size-16" />
        )}
      </div>
      <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
        {rows.map(({ label, value, wrap }) => (
          <div key={label} className="contents">
            <dt className="text-ink-faint">{label}</dt>
            <dd className={wrap ? "text-ink" : "truncate text-ink"}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: "text" | "email";
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
  multiline?: boolean;
  hint?: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
}

function Field({ label, name, type = "text", autoComplete, required, maxLength, multiline, hint, error, inputRef }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const shared = {
    id,
    name,
    required,
    maxLength,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: `${inputClass(Boolean(error))} mt-1.5`,
  };
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea rows={3} {...shared} />
      ) : (
        <input ref={inputRef} type={type} autoComplete={autoComplete} {...shared} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
