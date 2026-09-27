import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import type { PriceQuote, ValidationReport, WatchSpec } from "@/domain/types";
import { ApiError, placeOrder } from "../apiClient";
import { formatPrice, plural } from "../ui/format";
import { CrossIcon } from "../ui/icons";
import { buttonClass, cardClass, inputClass } from "../ui/styles";

interface OrderPanelProps {
  spec: WatchSpec;
  report: ValidationReport;
  quote: PriceQuote;
}

export function OrderPanel({ spec, report, quote }: OrderPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const blockedId = useId();

  return (
    <section aria-label="Order" className={`${cardClass} p-5 sm:p-6`}>
      <button
        type="button"
        disabled={!report.buildable}
        aria-describedby={report.buildable ? undefined : blockedId}
        onClick={() => dialogRef.current?.showModal()}
        className={`${buttonClass("primary", "lg")} w-full`}
      >
        Order this watch &middot; {formatPrice(quote.suggestedRetailEur)}
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
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <OrderForm spec={spec} quote={quote} onCancel={() => dialogRef.current?.close()} />
      </dialog>
    </section>
  );
}

type FieldErrors = Partial<Record<"name" | "email" | "notes", string>>;

interface OrderFormProps {
  spec: WatchSpec;
  quote: PriceQuote;
  onCancel: () => void;
}

function OrderForm({ spec, quote, onCancel }: OrderFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fieldErrors: FieldErrors = {
    name: error?.fields["customer.name"],
    email: error?.fields["customer.email"],
    notes: error?.fields.notes,
  };
  const blockingIssues = error?.report?.issues.filter((issue) => issue.severity === "error") ?? [];

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
      router.push(`/orders/${encodeURIComponent(order.id)}?placed=1`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError("Something went wrong. Please try again.", 0));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="order-dialog-title" className="font-display text-2xl font-semibold">
            Order &ldquo;{spec.name.trim() || "your watch"}&rdquo;
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {formatPrice(quote.suggestedRetailEur)} excl. VAT &middot; ready in about{" "}
            {plural(quote.leadTimeDays, "day")}
          </p>
        </div>
        <button type="button" onClick={onCancel} className={buttonClass("ghost", "sm")} aria-label="Close">
          <CrossIcon />
        </button>
      </div>

      <Field label="Your name" name="name" autoComplete="name" required error={fieldErrors.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
      <Field
        label="Notes for the watchmaker"
        name="notes"
        multiline
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
        order, then it goes to the workshop queue with its build sheet.
      </p>
    </form>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: "text" | "email";
  autoComplete?: string;
  required?: boolean;
  multiline?: boolean;
  hint?: string;
  error?: string;
}

function Field({ label, name, type = "text", autoComplete, required, multiline, hint, error }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const shared = {
    id,
    name,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: `${inputClass(Boolean(error))} mt-1.5`,
  };
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {multiline ? <textarea rows={3} {...shared} /> : <input type={type} autoComplete={autoComplete} {...shared} />}
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
