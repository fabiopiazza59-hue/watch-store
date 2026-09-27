import { resolveSpec, SLOTS } from "@/domain/catalog";
import type { WatchSpec } from "@/domain/types";
import { partHighlights, partSwatch } from "../parts/partInfo";
import { PartSwatch, SwatchPlaceholder } from "../parts/PartSwatch";

/** Every part of a design, one line per slot, plus any personalization. */
export function SpecSummary({ spec }: { spec: WatchSpec }) {
  const parts = resolveSpec(spec);
  const { dialText, casebackEngraving } = spec.personalization;
  const personalization = [
    { label: "Dial text", value: dialText.trim() },
    { label: "Engraving", value: casebackEngraving.trim() },
  ].filter(({ value }) => value !== "");

  return (
    <dl className="divide-y divide-line">
      {SLOTS.map((def) => {
        const part = parts[def.category];
        const swatch = part ? partSwatch(part) : null;
        return (
          <div key={def.slot} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2.5">
            <dt className="pt-0.5 text-xs font-medium tracking-[0.08em] text-ink-faint uppercase">{def.label}</dt>
            <dd className="flex items-start gap-2.5">
              {swatch ? (
                <PartSwatch swatch={swatch} className="mt-0.5 size-5" />
              ) : (
                <SwatchPlaceholder className="mt-0.5 size-5" />
              )}
              <span className="min-w-0">
                <span className="text-sm font-medium text-ink">
                  {part?.name ?? (def.optional ? "None" : "Missing part")}
                </span>
                {part && <span className="block text-xs text-ink-faint">{partHighlights(part).join(" · ")}</span>}
              </span>
            </dd>
          </div>
        );
      })}
      {personalization.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2.5">
          <dt className="pt-0.5 text-xs font-medium tracking-[0.08em] text-ink-faint uppercase">{label}</dt>
          <dd className="text-sm font-medium break-words text-ink">&ldquo;{value}&rdquo;</dd>
        </div>
      ))}
    </dl>
  );
}
