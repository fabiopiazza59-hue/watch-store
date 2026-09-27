// Shared class recipes, so buttons and cards look the same on every page.

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/85",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink/40 hover:bg-surface-muted",
  ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
};

// Taller on phones, where they are tapped.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-10 px-3 text-sm sm:h-8",
  md: "h-11 px-4 text-sm sm:h-10",
  lg: "h-12 px-6 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}`;
}

export const cardClass = "rounded-xl border border-line bg-surface";

const CHIP_BASE = "inline-flex items-center gap-1.5 rounded-full border px-3 py-2.5 text-sm transition-colors sm:py-1.5";

export function chipClass(selected = false): string {
  return selected
    ? `${CHIP_BASE} border-ink bg-ink text-paper`
    : `${CHIP_BASE} border-line-strong bg-surface text-ink-soft hover:border-ink/40 hover:text-ink`;
}

export const eyebrowClass = "text-xs font-medium uppercase tracking-[0.14em] text-brass-ink";

const INPUT_BASE =
  "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-brass-ink";

export function inputClass(invalid = false): string {
  return `${INPUT_BASE} ${invalid ? "border-danger" : "border-control-border"}`;
}
