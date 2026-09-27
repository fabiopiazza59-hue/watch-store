"use client";

import { useId } from "react";
import type { Personalization, ResolvedSpec } from "@/domain/types";
import { BezelLayer } from "./bezel";
import { CaseLayer } from "./case";
import { CrystalLayer } from "./crystal";
import { SharedDefs } from "./defs";
import { describeWatch } from "./describe";
import { DialLayer } from "./dial";
import { DimensionsLayer } from "./dimensions";
import { fmt, positive } from "./geometry";
import { HandsLayer } from "./hands";
import { computeLayout } from "./layout";
import { isPrintableDialText } from "./printableText";
import { StrapLayer } from "./strap";
import { idFactory } from "./svg";

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

/**
 * Top-down, to-scale drawing of a design. The viewBox is in millimetres and centred on the dial,
 * and every part is drawn from its catalogue dimensions, so what you see is what can be built:
 * a mismatched part looks mismatched. Dial text that could never be printed (a brand, "Swiss", a
 * dial that takes no print) is shown only as an outline of where it would go.
 */
export function WatchPreview({ parts, personalization, size = 420, showDimensions = false, className }: WatchPreviewProps) {
  const idFor = idFactory(useId());
  const layout = computeLayout(parts);
  const half = layout.viewHalf;
  const px = fmt(positive(size, 420));
  // A dial made for another crown position sits turned (see DialLayer); hands are set against it.
  const dialTurn = layout.dialTurnDeg ? `rotate(${fmt(layout.dialTurnDeg)})` : undefined;
  const dialTextPrintable = isPrintableDialText(parts.dial, personalization.dialText);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${fmt(-half)} ${fmt(-half)} ${fmt(half * 2)} ${fmt(half * 2)}`}
      width={px}
      height={px}
      role="img"
      aria-label={describeWatch(parts, dialTextPrintable ? personalization.dialText : "")}
      className={className}
    >
      <SharedDefs idFor={idFor} viewHalf={half} />
      {/* data-part marks each layer for tests and for highlighting parts in the configurator. */}
      <g data-part="strap">
        <StrapLayer strap={parts.strap} layout={layout} idFor={idFor} />
      </g>
      <g data-part="case">
        <CaseLayer watchCase={parts.case} layout={layout} idFor={idFor} />
      </g>
      <g data-part="bezel">
        <BezelLayer watchCase={parts.case} insert={parts.bezelInsert} layout={layout} idFor={idFor} />
      </g>
      <g data-part="dial">
        <DialLayer
          watchCase={parts.case}
          dial={parts.dial}
          dialText={personalization.dialText}
          dialTextPrintable={dialTextPrintable}
          layout={layout}
          idFor={idFor}
        />
      </g>
      <g data-part="hands" transform={dialTurn}>
        <HandsLayer hands={parts.hands} dial={parts.dial} idFor={idFor} />
      </g>
      <g data-part="crystal">
        <CrystalLayer crystal={parts.crystal} layout={layout} idFor={idFor} />
      </g>
      {showDimensions && parts.case && (
        <g data-part="dimensions">
          <DimensionsLayer layout={layout} />
        </g>
      )}
    </svg>
  );
}
