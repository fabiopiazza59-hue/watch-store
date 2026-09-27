import { useId, useState } from "react";
import { waterResistanceLabel } from "@/components/parts/partInfo";
import { WatchPreview } from "@/components/preview/WatchPreview";
import { DEFAULT_SPEC, SLOTS, TEMPLATES } from "@/domain/catalog";
import { DESIGN_NAME_MAX_LENGTH } from "@/domain/schemas";
import type { PriceQuote, ResolvedSpec, ValidationReport, WatchSpec } from "@/domain/types";
import { capitalize, formatMm, formatPrice, plural, vatNote } from "../ui/format";
import { CheckIcon, CrossIcon, ResetIcon, RulerIcon, ShareIcon } from "../ui/icons";
import { buttonClass, cardClass, chipClass, eyebrowClass } from "../ui/styles";
import { applyTemplate, templateLabel } from "./applyTemplate";
import { shareUrl } from "./specCodec";

/** Anchor for links that bring the watch into view. */
export const PREVIEW_ID = "preview";
/** The drawing itself, watched to tell when it has scrolled out of view. */
export const PREVIEW_DRAWING_ID = "preview-drawing";

interface PreviewStageProps {
  spec: WatchSpec;
  parts: ResolvedSpec;
  report: ValidationReport;
  quote: PriceQuote;
  onChange: (next: WatchSpec) => void;
  onReplace: (next: WatchSpec, label: string) => void;
}

export function PreviewStage({ spec, parts, report, quote, onChange, onReplace }: PreviewStageProps) {
  const nameId = useId();
  const [showDimensions, setShowDimensions] = useState(false);

  return (
    <section id={PREVIEW_ID} aria-label="Your watch" className={`${cardClass} scroll-mt-6 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor={nameId} className={eyebrowClass}>
            Your design
          </label>
          <input
            id={nameId}
            value={spec.name}
            maxLength={DESIGN_NAME_MAX_LENGTH}
            placeholder="Name your design"
            onChange={(event) => onChange({ ...spec, name: event.target.value })}
            className="mt-1 w-full rounded-md border-b border-dashed border-line-strong bg-transparent pb-1 font-display text-3xl font-semibold tracking-tight text-ink placeholder:text-ink-faint hover:border-ink/40 focus-visible:border-solid focus-visible:border-brass-ink"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <VerdictChip report={report} />
          <p className="text-sm text-ink-soft">
            <strong className="font-semibold text-ink tabular-nums">{formatPrice(quote.retailInclVatEur)}</strong>{" "}
            {vatNote(quote)} &middot; about {plural(quote.leadTimeDays, "day")}
          </p>
        </div>
      </div>

      <div id={PREVIEW_DRAWING_ID} className="mx-auto mt-5 aspect-square w-full max-w-[440px] overflow-hidden">
        <WatchPreview
          parts={parts}
          personalization={spec.personalization}
          size={440}
          showDimensions={showDimensions}
          className="h-auto w-full max-w-full"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <DimensionsSwitch checked={showDimensions} onChange={setShowDimensions} />
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton spec={spec} />
          <button
            type="button"
            onClick={() => onReplace(DEFAULT_SPEC, "Started over from the default design.")}
            className={buttonClass("ghost", "sm")}
          >
            <ResetIcon />
            Reset
          </button>
        </div>
      </div>

      <KeySpecs parts={parts} />
      <TemplatePicker spec={spec} onReplace={onReplace} />
    </section>
  );
}

export function VerdictChip({ report }: { report: ValidationReport }) {
  const errors = report.issues.filter((issue) => issue.severity === "error").length;
  return (
    <a
      href="#feasibility"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
        report.buildable ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"
      }`}
    >
      {report.buildable ? <CheckIcon /> : <CrossIcon />}
      {report.buildable ? "Buildable" : `Needs changes · ${errors}`}
    </a>
  );
}

function DimensionsSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 rounded-full py-1 pr-2 text-sm text-ink-soft hover:text-ink"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-ink" : "bg-control-border"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-surface shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
      <RulerIcon />
      Show dimensions
    </button>
  );
}

type ShareState = { status: "idle" } | { status: "copied" } | { status: "manual"; url: string };

function ShareButton({ spec }: { spec: WatchSpec }) {
  const [share, setShare] = useState<ShareState>({ status: "idle" });

  async function copyLink() {
    const url = shareUrl(window.location.origin, spec);
    try {
      await navigator.clipboard.writeText(url);
      setShare({ status: "copied" });
      window.setTimeout(() => setShare({ status: "idle" }), 2500);
    } catch {
      setShare({ status: "manual", url });
    }
  }

  return (
    <>
      <button type="button" onClick={copyLink} className={buttonClass("secondary", "sm")}>
        {share.status === "copied" ? <CheckIcon /> : <ShareIcon />}
        {share.status === "copied" ? "Link copied" : "Share"}
      </button>
      <span role="status" className="sr-only">
        {share.status === "copied" ? "A link to this design is on your clipboard." : ""}
      </span>
      {share.status === "manual" && (
        <label className="flex w-full flex-col gap-1 text-xs text-ink-soft">
          Copy this link to share your design:
          <input
            readOnly
            value={share.url}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-lg border border-control-border bg-surface px-3 py-2 font-mono text-xs text-ink focus-visible:border-brass-ink"
          />
        </label>
      )}
    </>
  );
}

const KEY_SPECS: { label: string; value: (parts: ResolvedSpec) => string | undefined }[] = [
  { label: "Case", value: ({ case: c }) => c && formatMm(c.diameterMm) },
  { label: "Lug to lug", value: ({ case: c }) => c && formatMm(c.lugToLugMm) },
  { label: "Thickness", value: ({ case: c }) => c && formatMm(c.thicknessMm) },
  { label: "Lug width", value: ({ case: c }) => c && formatMm(c.lugWidthMm) },
  { label: "Water resistance", value: ({ case: c }) => c && waterResistanceLabel(c) },
  { label: "Movement", value: ({ movement }) => movement?.caliber },
  { label: "Crystal", value: ({ crystal }) => crystal && capitalize(`${crystal.material}, ${crystal.shape}`) },
  { label: "Power reserve", value: ({ movement }) => movement && `${movement.powerReserveHours} h` },
];

function KeySpecs({ parts }: { parts: ResolvedSpec }) {
  return (
    <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
      {KEY_SPECS.map(({ label, value }) => (
        <div key={label} className="bg-surface px-3 py-2.5">
          <dt className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-ink tabular-nums">{value(parts) ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function usesSameParts(a: WatchSpec, b: WatchSpec): boolean {
  return SLOTS.every(({ slot }) => a[slot] === b[slot]);
}

function TemplatePicker({ spec, onReplace }: Pick<PreviewStageProps, "spec" | "onReplace">) {
  const active = TEMPLATES.find((template) => usesSameParts(template.spec, spec));
  return (
    <div className="mt-5">
      <h3 className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">Start from</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {TEMPLATES.map((template) => {
          const isActive = template.id === active?.id;
          return (
            <li key={template.id}>
              <button
                type="button"
                aria-pressed={isActive}
                title={template.description}
                onClick={() => onReplace(applyTemplate(spec, template), templateLabel(spec, template))}
                className={chipClass(isActive)}
              >
                {template.name}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 min-h-5 text-xs text-ink-faint">
        {active
          ? active.description
          : "Every starting design is buildable as it comes. Your name, dial text, engraving and extras are kept."}
      </p>
    </div>
  );
}
