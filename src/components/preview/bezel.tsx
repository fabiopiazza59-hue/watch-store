import type { BezelInsert, WatchCase } from "@/domain/types";
import { caseMetal, colorName, lumeDayColor, safeHex, type MetalTone } from "./color";
import { fmt, polar, positive, radialTicks, ring, sector, xy } from "./geometry";
import type { WatchLayout } from "./layout";
import { PLACEHOLDER, SANS, url, type IdFor } from "./svg";

interface BezelLayerProps {
  watchCase?: WatchCase;
  insert?: BezelInsert;
  layout: WatchLayout;
  idFor: IdFor;
}

/** The ring around the crystal: rotating bezel with insert, fixed polished bezel, or just the case lip. */
export function BezelLayer({ watchCase, insert, layout, idFor }: BezelLayerProps) {
  if (!watchCase) return null;
  const metal = caseMetal(watchCase.material, watchCase.finish);

  switch (layout.bezel) {
    case "unidirectional-120":
    case "bidirectional-24h":
      return <RotatingBezel insert={insert} layout={layout} metal={metal} idFor={idFor} />;
    case "fixed":
      return <FixedBezel layout={layout} metal={metal} idFor={idFor} />;
    default:
      return <CaseLip layout={layout} />;
  }
}

function RotatingBezel({
  insert,
  layout,
  metal,
  idFor,
}: {
  insert?: BezelInsert;
  layout: WatchLayout;
  metal: MetalTone;
  idFor: IdFor;
}) {
  const outerR = layout.bezelOuterR;
  const seat = layout.insertSeat ?? { innerR: layout.openingR, outerR: outerR - 1.6 };
  const teethR = outerR - 0.32;
  const toothPitch = (2 * Math.PI * teethR) / 120;

  return (
    <g>
      <defs>
        <linearGradient id={idFor("bezel-metal")} gradientUnits="userSpaceOnUse" x1={fmt(-outerR)} y1={fmt(-outerR)} x2={fmt(outerR)} y2={fmt(outerR)}>
          <stop offset="0" stopColor={metal.highlight} />
          <stop offset="0.45" stopColor={metal.mid} />
          <stop offset="0.7" stopColor={metal.light} />
          <stop offset="1" stopColor={metal.shade} />
        </linearGradient>
      </defs>
      <path d={ring(outerR, seat.innerR)} fillRule="evenodd" fill={url(idFor("bezel-metal"))} />
      <circle
        r={fmt(teethR)}
        fill="none"
        stroke={metal.edge}
        strokeWidth="0.56"
        strokeDasharray={`${fmt(toothPitch * 0.45)} ${fmt(toothPitch * 0.55)}`}
        opacity={0.6}
      />
      <circle r={fmt(outerR - 0.7)} fill="none" stroke={metal.highlight} strokeWidth="0.1" opacity={0.55} />
      <circle r={fmt(outerR - 0.04)} fill="none" stroke={metal.edge} strokeWidth="0.08" />
      {insert ? (
        <Insert insert={insert} seat={seat} idFor={idFor} />
      ) : (
        <path d={ring(seat.outerR, seat.innerR)} fillRule="evenodd" {...PLACEHOLDER} />
      )}
      <circle r={fmt(seat.innerR + 0.08)} fill="none" stroke="#000" strokeWidth="0.16" opacity={0.45} />
    </g>
  );
}

function Insert({
  insert,
  seat,
  idFor,
}: {
  insert: BezelInsert;
  seat: { innerR: number; outerR: number };
  idFor: IdFor;
}) {
  // Drawn at the insert's own size, so a mismatched insert visibly over- or under-fills its seat.
  let outerR = positive(insert.outerMm, seat.outerR * 2) / 2;
  let innerR = positive(insert.innerMm, seat.innerR * 2) / 2;
  if (innerR >= outerR) ({ innerR, outerR } = seat);

  const base = safeHex(insert.colorHex, "#1b1c1e");
  const print = safeHex(insert.printColorHex, "#f2f2ee");
  const ceramic = insert.material === "ceramic";
  const twoTone = insert.scale === "gmt-24" && insert.secondaryColorHex !== undefined;
  const band = { innerR, outerR, width: outerR - innerR, mid: (innerR + outerR) / 2 };

  return (
    <g>
      <defs>
        <linearGradient id={idFor("insert-light")} gradientUnits="userSpaceOnUse" x1={fmt(-outerR)} y1={fmt(-outerR)} x2={fmt(outerR)} y2={fmt(outerR)}>
          <stop offset="0" stopColor="#fff" stopOpacity={ceramic ? 0.26 : 0.12} />
          <stop offset="0.42" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.6" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={ceramic ? 0.32 : 0.24} />
        </linearGradient>
        <radialGradient id={idFor("insert-slope")} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={fmt(outerR)}>
          <stop offset={fmt(innerR / outerR)} stopColor="#000" stopOpacity={0.35} />
          <stop offset={fmt((innerR + band.width * 0.2) / outerR)} stopColor="#000" stopOpacity={0} />
          <stop offset={fmt((outerR - band.width * 0.15) / outerR)} stopColor="#fff" stopOpacity={ceramic ? 0.12 : 0.05} />
          <stop offset="1" stopColor="#000" stopOpacity={0.3} />
        </radialGradient>
      </defs>

      {twoTone ? (
        <>
          <path d={sector(innerR, outerR, -90, 90)} fill={safeHex(insert.secondaryColorHex, base)} />
          <path d={sector(innerR, outerR, 90, 270)} fill={base} />
        </>
      ) : (
        <path d={ring(outerR, innerR)} fillRule="evenodd" fill={base} />
      )}
      <path d={ring(outerR, innerR)} fillRule="evenodd" fill={url(idFor("insert-slope"))} />

      <InsertScale insert={insert} band={band} print={print} />

      <path d={ring(outerR, innerR)} fillRule="evenodd" fill={url(idFor("insert-light"))} />
      {ceramic && (
        <path
          d={`M${xy(polar(outerR - band.width * 0.3, 282))}A${fmt(outerR - band.width * 0.3)} ${fmt(outerR - band.width * 0.3)} 0 0 1 ${xy(polar(outerR - band.width * 0.3, 338))}`}
          fill="none"
          stroke="#fff"
          strokeWidth={fmt(band.width * 0.35)}
          strokeLinecap="round"
          opacity={0.22}
          filter={url(idFor("blur-glow"))}
        />
      )}
      <circle r={fmt(outerR)} fill="none" stroke="#000" strokeWidth="0.08" opacity={0.5} />
    </g>
  );
}

interface Band {
  innerR: number;
  outerR: number;
  width: number;
  mid: number;
}

function InsertScale({ insert, band, print }: { insert: BezelInsert; band: Band; print: string }) {
  const { innerR, outerR, width, mid } = band;
  const pipColor = lumeDayColor(colorName(print) === "gold" ? "vintage" : "green");
  const triangle = `M0 ${fmt(-(innerR + width * 0.2))}L${fmt(width * 0.36)} ${fmt(-(outerR - width * 0.13))}L${fmt(-width * 0.36)} ${fmt(-(outerR - width * 0.13))}Z`;
  const pip = insert.lumePip ? (
    <circle cy={fmt(-(outerR - width * 0.34))} r={fmt(width * 0.13)} fill={pipColor} stroke="#000" strokeOpacity={0.35} strokeWidth="0.06" />
  ) : null;

  if (insert.scale === "plain") return pip;

  const numeral = (label: string, deg: number, size: number) => (
    <text
      key={label}
      transform={`rotate(${fmt(deg)}) translate(0 ${fmt(-mid)})`}
      fontSize={fmt(size)}
      fontFamily={SANS}
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="central"
      fill={print}
    >
      {label}
    </text>
  );

  if (insert.scale === "gmt-24") {
    const hours = Array.from({ length: 23 }, (_, i) => i + 1);
    return (
      <g>
        <path d={triangle} fill={print} />
        {pip}
        <path
          d={radialTicks(hours.filter((h) => h % 2 === 1).map((h) => h * 15), mid + width * 0.13, mid - width * 0.13)}
          stroke={print}
          strokeWidth={fmt(width * 0.12)}
        />
        {hours.filter((h) => h % 2 === 0).map((h) => numeral(String(h), h * 15, width * 0.44))}
      </g>
    );
  }

  // Dive scales count up clockwise; countdown scales run the same marks anticlockwise from 60.
  const direction = insert.scale === "countdown-60" ? -1 : 1;
  const at = (minute: number) => direction * minute * 6;
  const fineMinutes = Array.from({ length: 14 }, (_, i) => i + 1).filter((m) => m % 5 !== 0);

  return (
    <g>
      <path d={triangle} fill={print} />
      {pip}
      <path
        d={radialTicks(fineMinutes.map(at), outerR - width * 0.14, outerR - width * 0.42)}
        stroke={print}
        strokeWidth={fmt(width * 0.055)}
      />
      <path
        d={radialTicks([5, 15, 25, 35, 45, 55].map(at), mid + width * 0.2, mid - width * 0.2)}
        stroke={print}
        strokeWidth={fmt(width * 0.15)}
      />
      {[10, 20, 30, 40, 50].map((m) => numeral(String(m), at(m), width * 0.5))}
    </g>
  );
}

function FixedBezel({ layout, metal, idFor }: { layout: WatchLayout; metal: MetalTone; idFor: IdFor }) {
  const outerR = layout.bezelOuterR;
  const innerR = layout.openingR;
  const at = (t: number) => fmt((innerR + (outerR - innerR) * t) / outerR);
  return (
    <g>
      <defs>
        <radialGradient id={idFor("fixed-bezel")} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={fmt(outerR)}>
          <stop offset={at(0)} stopColor={metal.shade} />
          <stop offset={at(0.3)} stopColor={metal.light} />
          <stop offset={at(0.55)} stopColor={metal.highlight} />
          <stop offset={at(0.85)} stopColor={metal.mid} />
          <stop offset="1" stopColor={metal.shade} />
        </radialGradient>
        <linearGradient id={idFor("fixed-bezel-light")} gradientUnits="userSpaceOnUse" x1={fmt(-outerR)} y1={fmt(-outerR)} x2={fmt(outerR)} y2={fmt(outerR)}>
          <stop offset="0" stopColor="#fff" stopOpacity={0.3} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.3} />
        </linearGradient>
      </defs>
      <path d={ring(outerR, innerR)} fillRule="evenodd" fill={url(idFor("fixed-bezel"))} />
      <path d={ring(outerR, innerR)} fillRule="evenodd" fill={url(idFor("fixed-bezel-light"))} />
      <circle r={fmt(outerR)} fill="none" stroke={metal.edge} strokeWidth="0.1" opacity={0.8} />
      <circle r={fmt(innerR + 0.1)} fill="none" stroke="#000" strokeWidth="0.2" opacity={0.4} />
    </g>
  );
}

/** Bezel-less cases: just the shadowed step where the case meets the crystal. */
function CaseLip({ layout }: { layout: WatchLayout }) {
  return (
    <g fill="none">
      <circle r={fmt(layout.openingR + 0.1)} stroke="#000" strokeWidth="0.2" opacity={0.4} />
      <circle r={fmt(layout.openingR + 0.38)} stroke="#fff" strokeWidth="0.12" opacity={0.35} />
    </g>
  );
}
