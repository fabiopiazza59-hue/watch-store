import { resolveExtras, resolveSpec, SLOTS } from "@/domain/catalog";
import type { ResolvedExtras, ResolvedSpec, SlotKey, WatchSpec } from "@/domain/types";
import { partHighlights, partSwatch } from "../parts/partInfo";
import { PartSwatch, SwatchPlaceholder } from "../parts/PartSwatch";

interface SpecSummaryProps {
  spec: WatchSpec;
  /** The parts to show; by default, today's catalogue entries for the spec's ids. */
  parts?: ResolvedSpec;
  /** Names to show for parts `parts` lacks, such as an ordered part the catalogue no longer lists. */
  orderedNames?: Partial<Record<SlotKey, string>>;
  /** The spare strap and add-ons to show; by default, today's catalogue entries for the spec's extras. */
  extras?: ResolvedExtras;
}

const rowClass = "grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2.5";
const labelClass = "pt-0.5 text-xs font-medium tracking-[0.08em] text-ink-faint uppercase";

/** Every part of a design, one line per slot, plus any personalization, spare strap and add-ons. */
export function SpecSummary({
  spec,
  parts = resolveSpec(spec),
  orderedNames = {},
  extras = resolveExtras(spec),
}: SpecSummaryProps) {
  const { dialText, casebackEngraving } = spec.personalization;
  const personalization = [
    { label: "Dial text", value: dialText.trim() },
    { label: "Engraving", value: casebackEngraving.trim() },
  ].filter(({ value }) => value !== "");
  const spare = extras.spareStrap;
  const spareSwatch = spare ? partSwatch(spare) : null;

  return (
    <dl className="divide-y divide-line">
      {SLOTS.map((def) => {
        const part = parts[def.category];
        const swatch = part ? partSwatch(part) : null;
        return (
          <div key={def.slot} className={rowClass}>
            <dt className={labelClass}>{def.label}</dt>
            <dd className="flex items-start gap-2.5">
              {swatch ? (
                <PartSwatch swatch={swatch} className="mt-0.5 size-5" />
              ) : (
                <SwatchPlaceholder className="mt-0.5 size-5" />
              )}
              <span className="min-w-0">
                <span className="text-sm font-medium text-ink">
                  {part?.name ?? orderedNames[def.slot] ?? (def.optional && !spec[def.slot] ? "None" : "Missing part")}
                </span>
                {part && <span className="block text-xs text-ink-faint">{partHighlights(part).join(" · ")}</span>}
              </span>
            </dd>
          </div>
        );
      })}
      {personalization.map(({ label, value }) => (
        <div key={label} className={rowClass}>
          <dt className={labelClass}>{label}</dt>
          <dd className="text-sm font-medium break-words text-ink">&ldquo;{value}&rdquo;</dd>
        </div>
      ))}
      {spare && (
        <div className={rowClass}>
          <dt className={labelClass}>Spare strap</dt>
          <dd className="flex items-start gap-2.5">
            {spareSwatch ? (
              <PartSwatch swatch={spareSwatch} className="mt-0.5 size-5" />
            ) : (
              <SwatchPlaceholder className="mt-0.5 size-5" />
            )}
            <span className="min-w-0">
              <span className="text-sm font-medium text-ink">{spare.name}</span>
              <span className="block text-xs text-ink-faint">{partHighlights(spare).join(" · ")}</span>
            </span>
          </dd>
        </div>
      )}
      {extras.items.length > 0 && (
        <div className={rowClass}>
          <dt className={labelClass}>Add-ons</dt>
          <dd>
            <ul className="flex flex-col gap-1 text-sm font-medium text-ink">
              {extras.items.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}
