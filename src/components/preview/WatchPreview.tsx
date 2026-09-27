// CONTRACT STUB — implemented by the preview build step. Keep these props.
import type { ResolvedSpec, Personalization } from "@/domain/types";

export interface WatchPreviewProps {
  /** Parts to draw; missing parts are drawn as neutral placeholders. */
  parts: ResolvedSpec;
  personalization: Personalization;
  /** Rendered width/height in CSS px (the SVG is square). Default 420. */
  size?: number;
  /** Overlay dimension callouts (case diameter, lug width, lug-to-lug). */
  showDimensions?: boolean;
  className?: string;
}

export function WatchPreview(props: WatchPreviewProps) {
  void props;
  return null;
}
