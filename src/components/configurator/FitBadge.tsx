import { AlertIcon, CheckIcon, CrossIcon } from "../ui/icons";
import { type Fit, FIT_LABELS } from "./fit";

const FIT_STYLES: Record<Fit, string> = {
  fits: "bg-ok-soft text-ok",
  caveats: "bg-warn-soft text-warn",
  "wont-fit": "bg-danger-soft text-danger",
};

const FIT_ICONS: Record<Fit, typeof CheckIcon> = {
  fits: CheckIcon,
  caveats: AlertIcon,
  "wont-fit": CrossIcon,
};

export function FitBadge({ fit }: { fit: Fit }) {
  const Icon = FIT_ICONS[fit];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${FIT_STYLES[fit]}`}
    >
      <Icon className="size-3.5" />
      {FIT_LABELS[fit]}
    </span>
  );
}
