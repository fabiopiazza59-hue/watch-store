import { fmt, mm } from "./geometry";
import type { WatchLayout } from "./layout";
import { SANS } from "./svg";

const INK = "#b0512c";
const LABEL_INK = "#2f2a25";
const FONT_SIZE = 1.65;

/** Thin callout lines for case diameter, lug-to-lug and lug width, drawn over the watch. */
export function DimensionsLayer({ layout }: { layout: WatchLayout }) {
  const { caseR, lugToLug, lugWidth } = layout;
  const tip = lugToLug / 2;
  const lugOuterX = layout.lugX.outer;

  const diameterY = -(tip + 2.4);
  const lugToLugX = -(caseR + 2.6);
  const lugWidthY = tip + 1.6;

  return (
    <g fontFamily={SANS} fontSize={FONT_SIZE} fontWeight={600}>
      <Dimension
        from={[-caseR, diameterY]}
        to={[caseR, diameterY]}
        extensions={[
          [
            [-caseR, -1.2],
            [-caseR, diameterY - 0.7],
          ],
          [
            [caseR, -1.2],
            [caseR, diameterY - 0.7],
          ],
        ]}
        label={`Ø ${mm(caseR * 2)} mm case`}
        labelAt={[0, diameterY]}
      />
      <Dimension
        from={[lugToLugX, -tip]}
        to={[lugToLugX, tip]}
        extensions={[
          [
            [-lugOuterX - 0.4, -tip],
            [lugToLugX - 0.7, -tip],
          ],
          [
            [-lugOuterX - 0.4, tip],
            [lugToLugX - 0.7, tip],
          ],
        ]}
        label={`${mm(lugToLug)} mm lug to lug`}
        labelAt={[lugToLugX, 0]}
        vertical
      />
      <Dimension
        from={[-lugWidth / 2, lugWidthY]}
        to={[lugWidth / 2, lugWidthY]}
        extensions={[
          [
            [-lugWidth / 2, tip - 0.4],
            [-lugWidth / 2, lugWidthY + 0.7],
          ],
          [
            [lugWidth / 2, tip - 0.4],
            [lugWidth / 2, lugWidthY + 0.7],
          ],
        ]}
        label={`${mm(lugWidth)} mm lugs`}
        labelAt={[0, lugWidthY + 2.1]}
      />
    </g>
  );
}

type Pt = [number, number];

interface DimensionProps {
  from: Pt;
  to: Pt;
  extensions: [Pt, Pt][];
  label: string;
  labelAt: Pt;
  vertical?: boolean;
}

function Dimension({ from, to, extensions, label, labelAt, vertical = false }: DimensionProps) {
  const line = `M${fmt(from[0])} ${fmt(from[1])}L${fmt(to[0])} ${fmt(to[1])}`;
  const ext = extensions.map(([a, b]) => `M${fmt(a[0])} ${fmt(a[1])}L${fmt(b[0])} ${fmt(b[1])}`).join("");
  const labelWidth = label.length * FONT_SIZE * 0.56 + 1.4;
  const labelHeight = FONT_SIZE + 0.9;
  const [lx, ly] = labelAt;
  return (
    <g>
      {/* A pale halo keeps the hairlines readable over dark straps and dials. */}
      <g fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth="0.42" strokeLinecap="round">
        <path d={line} />
        <path d={ext} />
      </g>
      <g fill="none" stroke={INK} strokeLinecap="round">
        <path d={ext} strokeWidth="0.1" />
        <path d={line} strokeWidth="0.14" />
      </g>
      <Arrowhead at={from} towards={to} />
      <Arrowhead at={to} towards={from} />
      <g transform={`translate(${fmt(lx)} ${fmt(ly)})${vertical ? " rotate(-90)" : ""}`}>
        <rect
          x={fmt(-labelWidth / 2)}
          y={fmt(-labelHeight / 2)}
          width={fmt(labelWidth)}
          height={fmt(labelHeight)}
          rx={fmt(labelHeight / 2)}
          fill="#fbf8f3"
          fillOpacity={0.94}
          stroke={INK}
          strokeWidth="0.08"
        />
        <text textAnchor="middle" dominantBaseline="central" fill={LABEL_INK} letterSpacing="0.03">
          {label}
        </text>
      </g>
    </g>
  );
}

/** Small filled arrowhead with its point at `at`, opening back along the line. */
function Arrowhead({ at, towards }: { at: Pt; towards: Pt }) {
  const dx = towards[0] - at[0];
  const dy = towards[1] - at[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const back = 0.9;
  const half = 0.32;
  const bx = at[0] + ux * back;
  const by = at[1] + uy * back;
  const d =
    `M${fmt(at[0])} ${fmt(at[1])}` +
    `L${fmt(bx - uy * half)} ${fmt(by + ux * half)}` +
    `L${fmt(bx + uy * half)} ${fmt(by - ux * half)}Z`;
  return <path d={d} fill={INK} />;
}
