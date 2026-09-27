import type { Swatch } from "./partInfo";

/** A small colour chip for a part; decorative, since the part's name is always shown beside it. */
export function PartSwatch({ swatch, className = "size-7" }: { swatch: Swatch; className?: string }) {
  const background = swatch.split
    ? `linear-gradient(135deg, ${swatch.base} 50%, ${swatch.split} 50%)`
    : swatch.base;
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border border-ink/15 shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)] ${className}`}
      style={{ background }}
    >
      {swatch.accent && (
        <span className="size-1.5 rounded-full" style={{ background: swatch.accent }} />
      )}
    </span>
  );
}

/** Keeps rows aligned where a part has no colour choice (movements, crystals, "none"). */
export function SwatchPlaceholder({ className = "size-7" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 rounded-full border border-dashed border-line-strong ${className}`} />
  );
}
