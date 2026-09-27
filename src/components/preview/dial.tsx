import type { Dial, WatchCase } from "@/domain/types";
import { caseMetal, colorName, darken, GOLD, isDark, lighten, luminance, lumeDayColor, metalFrom, safeHex, SILVER } from "./color";
import { circle, divisions, fmt, polar, positive, radialTicks, ring, wedge } from "./geometry";
import type { WatchLayout } from "./layout";
import { PLACEHOLDER, SANS, SERIF, url, type IdFor } from "./svg";

/**
 * The NH3x date wheel sits at a fixed radius on the movement, so the aperture is at the same place
 * whatever the dial size: on a wide dial it lands well inside the numerals, as it does in reality.
 */
const DATE_CENTRE_X = 10.6;
const DATE_WIDTH = 2.3;
const DAY_WIDTH = 3.3;
const WINDOW_HEIGHT = 1.9;

/** Every preview shows the same Saturday the 27th, as it shows the same 10:09. */
const SHOWN_DATE = "27";
const SHOWN_DAY = "SAT";
/** NH day wheels print Saturday in blue (and Sunday in red) on the white wheel. */
const SATURDAY_BLUE = "#2456a6";

/** Hour positions as clock angles, 1 o'clock (30°) through 12 o'clock (360°). */
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const hourAngle = (hour: number) => hour * 30;

/** Marker and numeral sizes on a standard 28.5mm dial, in mm; they scale with the dial. */
const MARKER_LENGTH = 2.9;
const ROMAN_SIZE = 2.2;
const LUME_DOT_RING = 1.1;

interface DialLayerProps {
  watchCase?: WatchCase;
  dial?: Dial;
  dialText: string;
  layout: WatchLayout;
  idFor: IdFor;
}

/** Everything seen through the opening: case flange, dial and its print, date window, chapter ring. */
export function DialLayer({ watchCase, dial, dialText, layout, idFor }: DialLayerProps) {
  const { openingR, chapterRing } = layout;

  return (
    <g>
      <defs>
        <clipPath id={idFor("opening")}>
          <circle r={fmt(openingR)} />
        </clipPath>
      </defs>
      <g clipPath={url(idFor("opening"))}>
        {watchCase && <Flange watchCase={watchCase} layout={layout} idFor={idFor} />}
        {dial ? (
          <g transform={layout.dialTurnDeg ? `rotate(${fmt(layout.dialTurnDeg)})` : undefined}>
            <DialFace dial={dial} dialText={dialText} layout={layout} idFor={idFor} />
          </g>
        ) : (
          <circle r={fmt(layout.dialSeatR)} {...PLACEHOLDER} fillOpacity={1} />
        )}
        {chapterRing && <ChapterRing ring={chapterRing} dial={dial} idFor={idFor} />}
      </g>
    </g>
  );
}

/** The case's inner wall around the dial, visible where no chapter ring covers it. */
function Flange({ watchCase, layout, idFor }: { watchCase: WatchCase; layout: WatchLayout; idFor: IdFor }) {
  const tone = caseMetal(watchCase.material, watchCase.finish);
  return (
    <>
      <defs>
        <radialGradient id={idFor("flange")} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={fmt(layout.openingR)}>
          <stop offset={fmt(Math.min(0.98, layout.dialSeatR / layout.openingR))} stopColor={tone.edge} />
          <stop offset="1" stopColor={tone.mid} />
        </radialGradient>
      </defs>
      <circle r={fmt(layout.openingR)} fill={url(idFor("flange"))} />
    </>
  );
}

/** Radii of the printed zones, from the edge of the dial inwards. */
interface DialZones {
  /** Dial diameter relative to the standard 28.5mm; print sizes scale by it. */
  s: number;
  dialR: number;
  track?: { outer: number; inner: number };
  scale24?: { outer: number; inner: number };
  /** Outer end of the hour markers. */
  indexOuter: number;
}

function dialZones(dial: Dial, layout: WatchLayout): DialZones {
  const dialR = positive(dial.diameterMm, layout.dialSeatR * 2) / 2;
  const s = (dialR * 2) / 28.5;
  // Under a chapter ring the dial's outer 0.6mm is hidden and the minute track lives on the ring.
  const edge = layout.chapterRing ? dialR - 0.6 : dialR;
  const track = layout.chapterRing ? undefined : { outer: edge - 0.35 * s, inner: edge - 1.5 * s };
  let next = track ? track.inner - 0.4 * s : edge - 0.4 * s;
  let scale24;
  if (dial.has24hScale) {
    scale24 = { outer: next, inner: next - 1.6 * s };
    next = scale24.inner - 0.35 * s;
  }
  return { s, dialR, track, scale24, indexOuter: next };
}

function DialFace({ dial, dialText, layout, idFor }: { dial: Dial; dialText: string; layout: WatchLayout; idFor: IdFor }) {
  const zones = dialZones(dial, layout);
  const base = safeHex(dial.colorHex, "#1c1c1c");
  const print = safeHex(dial.printColorHex, isDark(base) ? "#f2f2ee" : "#1c1c1c");
  const hasDate = dial.dateWindow !== "none";

  return (
    <g>
      <circle r={fmt(zones.dialR)} fill={base} />
      <DialTexture dial={dial} base={base} dialR={zones.dialR} idFor={idFor} />
      {zones.track && <MinuteTrack dial={dial} track={zones.track} s={zones.s} print={print} />}
      {zones.scale24 && <Scale24 band={zones.scale24} s={zones.s} print={print} skipSix={hasDate} />}
      <Indices dial={dial} zones={zones} print={print} hasDate={hasDate} idFor={idFor} />
      {hasDate && <DateWindow dial={dial} base={base} print={print} idFor={idFor} />}
      <DialText text={dialText} dial={dial} zones={zones} print={print} />
    </g>
  );
}

function DialTexture({ dial, base, dialR, idFor }: { dial: Dial; base: string; dialR: number; idFor: IdFor }) {
  const vignette = (
    <>
      <defs>
        <radialGradient id={idFor("dial-vignette")} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={fmt(dialR)}>
          <stop offset="0" stopColor="#fff" stopOpacity={0.05} />
          <stop offset="0.7" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={dial.texture === "gloss" ? 0.3 : 0.22} />
        </radialGradient>
      </defs>
      <circle r={fmt(dialR)} fill={url(idFor("dial-vignette"))} />
    </>
  );

  switch (dial.texture) {
    case "sunburst":
      return (
        <>
          <Sunburst base={base} dialR={dialR} />
          {vignette}
        </>
      );
    case "grained":
      return (
        <>
          <circle r={fmt(dialR)} fill="#000" opacity={0.3} filter={url(idFor("grain"))} />
          {vignette}
        </>
      );
    case "gloss":
      return (
        <>
          {vignette}
          <defs>
            <radialGradient id={idFor("dial-gloss")} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff" stopOpacity={0.32} />
              <stop offset="1" stopColor="#fff" stopOpacity={0} />
            </radialGradient>
          </defs>
          <ellipse
            cx={fmt(-dialR * 0.38)}
            cy={fmt(-dialR * 0.42)}
            rx={fmt(dialR * 0.5)}
            ry={fmt(dialR * 0.3)}
            transform={`rotate(-40 ${fmt(-dialR * 0.38)} ${fmt(-dialR * 0.42)})`}
            fill={url(idFor("dial-gloss"))}
          />
        </>
      );
    default:
      return vignette;
  }
}

/**
 * Sunburst brushing reflects light in two opposite lobes. SVG has no conic gradient, so the dial is
 * built from thin wedges whose shade follows the light, with a fixed ripple standing in for the grain.
 */
function Sunburst({ base, dialR }: { base: string; dialR: number }) {
  const count = 180;
  const step = 360 / count;
  const lightDeg = 315;
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const centre = (i + 0.5) * step;
        const ripple = (((i * 7) % 5) - 2) * 0.008;
        const shade = Math.cos((2 * (centre - lightDeg) * Math.PI) / 180) * 0.2 + ripple;
        const fill = shade >= 0 ? lighten(base, shade) : darken(base, -shade);
        return <path key={i} d={wedge(dialR, i * step - 0.15, (i + 1) * step + 0.15)} fill={fill} />;
      })}
    </g>
  );
}

function MinuteTrack({ dial, track, s, print }: { dial: Dial; track: { outer: number; inner: number }; s: number; print: string }) {
  const minutes = divisions(60, (i) => i % 5 !== 0);
  const fives = divisions(60, (i) => i % 5 === 0);
  if (dial.style === "field" || dial.style === "dress") {
    const rail = track.outer - 0.75 * s;
    return (
      <g stroke={print} fill="none">
        <path d={`${circle(track.outer)}${circle(rail)}`} strokeWidth={fmt(0.08 * s)} />
        <path d={radialTicks(minutes, track.outer, rail)} strokeWidth={fmt(0.09 * s)} />
        <path d={radialTicks(fives, track.outer, track.inner)} strokeWidth={fmt(0.24 * s)} />
      </g>
    );
  }
  return (
    <g stroke={print} fill="none">
      <path d={radialTicks(minutes, track.outer, track.outer - 0.6 * s)} strokeWidth={fmt(0.11 * s)} />
      <path d={radialTicks(fives, track.outer, track.inner)} strokeWidth={fmt(0.26 * s)} />
    </g>
  );
}

function Scale24({ band, s, print, skipSix }: { band: { outer: number; inner: number }; s: number; print: string; skipSix: boolean }) {
  const mid = (band.outer + band.inner) / 2;
  const hours = Array.from({ length: 24 }, (_, i) => i + 1);
  return (
    <g fill={print}>
      <circle r={fmt(band.inner)} fill="none" stroke={print} strokeWidth={fmt(0.07 * s)} opacity={0.6} />
      {hours
        .filter((h) => h % 2 === 1)
        .map((h) => {
          const [x, y] = polar(mid, h * 15);
          return <circle key={h} cx={fmt(x)} cy={fmt(y)} r={fmt(0.13 * s)} />;
        })}
      {hours
        .filter((h) => h % 2 === 0 && !(skipSix && h === 6))
        .map((h) => {
          const [x, y] = polar(mid, h * 15);
          return (
            <text
              key={h}
              x={fmt(x)}
              y={fmt(y)}
              fontSize={fmt(0.95 * s)}
              fontFamily={SANS}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {h}
            </text>
          );
        })}
    </g>
  );
}

interface IndicesProps {
  dial: Dial;
  zones: DialZones;
  print: string;
  hasDate: boolean;
  idFor: IdFor;
}

function Indices(props: IndicesProps) {
  switch (props.dial.indices) {
    case "printed":
      return <MarkerIndices {...props} applied={false} />;
    case "applied":
      return props.dial.style === "diver" ? <MarkerIndices {...props} applied /> : <AppliedBatons {...props} />;
    case "arabic":
      return <ArabicNumerals {...props} />;
    case "roman":
      return <RomanNumerals {...props} />;
  }
}

/** Dive-style markers: plots, bars at the cardinal hours and a triangle at 12. Printed or applied. */
function MarkerIndices({ dial, zones, print, hasDate, idFor, applied }: IndicesProps & { applied: boolean }) {
  const { s, indexOuter } = zones;
  const lume = lumeDayColor(dial.lume);
  const plotR = 0.95 * s;
  const barLength = 2.7 * s;
  const barWidth = 1.2 * s;
  const hours = HOURS.filter((h) => !(hasDate && h === 3));

  /** One marker, shrunk by `inset` (the lume fill inside an applied marker's metal surround). */
  const marker = (h: number, inset: number) => {
    const deg = hourAngle(h);
    if (h === 12) {
      const apex = -(indexOuter - MARKER_LENGTH * s + inset * 1.9);
      const base = -(indexOuter - inset);
      const half = 1.35 * s - inset * 1.4;
      return <path key={h} d={`M0 ${fmt(apex)}L${fmt(half)} ${fmt(base)}L${fmt(-half)} ${fmt(base)}Z`} />;
    }
    if (h % 3 === 0) {
      return (
        <rect
          key={h}
          x={fmt(-barWidth / 2 + inset)}
          y={fmt(-indexOuter + inset)}
          width={fmt(barWidth - 2 * inset)}
          height={fmt(barLength - 2 * inset)}
          rx={fmt(0.1 * s)}
          transform={`rotate(${fmt(deg)})`}
        />
      );
    }
    const [x, y] = polar(indexOuter - plotR - 0.05 * s, deg);
    return <circle key={h} cx={fmt(x)} cy={fmt(y)} r={fmt(plotR - inset)} />;
  };
  const markers = (inset: number) => hours.map((h) => marker(h, inset));

  if (applied) {
    const metal = metalFrom(appliedMetal(print));
    const metalId = idFor("marker-metal");
    return (
      <g>
        <defs>
          <linearGradient id={metalId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={metal.highlight} />
            <stop offset="0.5" stopColor={metal.mid} />
            <stop offset="1" stopColor={metal.shade} />
          </linearGradient>
        </defs>
        <g fill={url(metalId)} filter={url(idFor("applied-shadow"))}>
          {markers(0)}
        </g>
        <g fill={lume ?? darken(safeHex(dial.colorHex, "#1c1c1c"), 0.25)}>{markers(0.26 * s)}</g>
      </g>
    );
  }

  return lume ? (
    <g fill={lume} stroke={print} strokeWidth={fmt(0.14 * s)}>
      {markers(0)}
    </g>
  ) : (
    <g fill={print}>{markers(0)}</g>
  );
}

/** Applied indices are silver unless the dial's print is gold. */
function appliedMetal(print: string): string {
  return colorName(print) === "gold" ? GOLD : SILVER;
}

function AppliedBatons({ dial, zones, print, hasDate, idFor }: IndicesProps) {
  const { s, indexOuter } = zones;
  const lume = lumeDayColor(dial.lume);
  const metal = metalFrom(appliedMetal(print));
  const length = MARKER_LENGTH * s;
  const width = 0.95 * s;
  const batons = HOURS.filter((h) => !(hasDate && h === 3)).flatMap((h) =>
    h === 12 ? [{ h, dx: -0.62 * s, w: 0.8 * s }, { h, dx: 0.62 * s, w: 0.8 * s }] : [{ h, dx: 0, w: width }],
  );
  const metalId = idFor("baton-metal");

  return (
    <g>
      <defs>
        <linearGradient id={metalId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={metal.light} />
          <stop offset="0.48" stopColor={metal.highlight} />
          <stop offset="0.52" stopColor={metal.shade} />
          <stop offset="1" stopColor={metal.mid} />
        </linearGradient>
      </defs>
      <g fill={url(metalId)} filter={url(idFor("applied-shadow"))}>
        {batons.map(({ h, dx, w }) => (
          <rect
            key={`${h}${dx}`}
            x={fmt(dx - w / 2)}
            y={fmt(-indexOuter)}
            width={fmt(w)}
            height={fmt(length)}
            rx={fmt(0.08 * s)}
            transform={`rotate(${fmt(hourAngle(h))})`}
          />
        ))}
      </g>
      {lume && (
        <g fill={lume}>
          {batons.map(({ h, dx, w }) => (
            <rect
              key={`${h}${dx}`}
              x={fmt(dx - w * 0.18)}
              y={fmt(-indexOuter + 0.4 * s)}
              width={fmt(w * 0.36)}
              height={fmt(length - 0.8 * s)}
              transform={`rotate(${fmt(hourAngle(h))})`}
            />
          ))}
        </g>
      )}
    </g>
  );
}

/**
 * How Arabic numerals are printed. Light print on a dark dial is the lume itself; dark print
 * gets a ring of separate lume dots outside the numerals.
 */
function arabicPrint(dial: Dial, print: string, s: number) {
  const lume = lumeDayColor(dial.lume);
  const lumedNumerals = lume !== undefined && luminance(print) > 0.45;
  return {
    lume,
    fontSize: (dial.style === "pilot" ? 3.1 : 2.6) * s,
    fill: lumedNumerals ? lume : print,
    dots: lume !== undefined && !lumedNumerals,
  };
}

function ArabicNumerals({ dial, zones, print, hasDate }: IndicesProps) {
  const { s } = zones;
  const pilot = dial.style === "pilot";
  const { lume, fontSize, fill: numeralFill, dots } = arabicPrint(dial, print, s);
  const outer = zones.indexOuter - (dots ? LUME_DOT_RING * s : 0);
  const hours = HOURS.filter((h) => !(hasDate && h === 3));

  return (
    <g>
      {dots && (
        <g fill={lume} stroke={print} strokeWidth={fmt(0.1 * s)}>
          {hours.map((h) => {
            const [x, y] = polar(zones.indexOuter - 0.45 * s, hourAngle(h));
            return <circle key={h} cx={fmt(x)} cy={fmt(y)} r={fmt(0.38 * s)} />;
          })}
        </g>
      )}
      <g fill={numeralFill} fontFamily={SANS} fontWeight={pilot ? 500 : 600} fontSize={fmt(fontSize)} textAnchor="middle">
        {hours.map((h) => {
          if (pilot && h === 12) return <PilotTriangle key={h} outer={outer} s={s} fill={numeralFill} />;
          const label = String(h);
          const [x, y] = polar(outer - fontSize * (label.length > 1 ? 0.72 : 0.6), hourAngle(h));
          return (
            <text key={h} x={fmt(x)} y={fmt(y)} dominantBaseline="central">
              {label}
            </text>
          );
        })}
      </g>
    </g>
  );
}

/** The flieger's triangle-and-dots at 12, in place of a numeral. */
function PilotTriangle({ outer, s, fill }: { outer: number; s: number; fill: string }) {
  const top = -(outer - 0.1 * s);
  const [dotX, dotY] = polar(outer - 0.5 * s, 9);
  return (
    <g fill={fill}>
      <path d={`M0 ${fmt(top + 3 * s)}L${fmt(1.1 * s)} ${fmt(top)}L${fmt(-1.1 * s)} ${fmt(top)}Z`} />
      <circle cx={fmt(dotX)} cy={fmt(dotY)} r={fmt(0.36 * s)} />
      <circle cx={fmt(-dotX)} cy={fmt(dotY)} r={fmt(0.36 * s)} />
    </g>
  );
}

/** Watchmakers' Roman numerals, oriented radially, with the traditional IIII. */
const ROMAN = ["I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function RomanNumerals({ zones, print, hasDate }: IndicesProps) {
  const { s } = zones;
  const fontSize = ROMAN_SIZE * s;
  const radius = zones.indexOuter - fontSize * 0.5;
  return (
    <g fill={print} fontFamily={SERIF} fontSize={fmt(fontSize)} textAnchor="middle">
      {HOURS.filter((h) => !(hasDate && h === 3)).map((h) => (
        <text key={h} transform={`rotate(${fmt(hourAngle(h))}) translate(0 ${fmt(-radius)})`} dominantBaseline="central">
          {ROMAN[h - 1]}
        </text>
      ))}
    </g>
  );
}

/** Radius where the hour markers end towards the centre, used to place the dial text. */
function indexInner(dial: Dial, zones: DialZones, print: string): number {
  const { s, indexOuter } = zones;
  switch (dial.indices) {
    case "arabic": {
      const { fontSize, dots } = arabicPrint(dial, print, s);
      return indexOuter - fontSize * 1.25 - (dots ? LUME_DOT_RING * s : 0);
    }
    case "roman":
      return indexOuter - ROMAN_SIZE * s;
    default:
      return indexOuter - MARKER_LENGTH * s;
  }
}

function DateWindow({ dial, base, print, idFor }: { dial: Dial; base: string; print: string; idFor: IdFor }) {
  const dayDate = dial.dateWindow === "day-date-3";
  const left = DATE_CENTRE_X - DATE_WIDTH / 2 - (dayDate ? DAY_WIDTH : 0);
  const width = DATE_WIDTH + (dayDate ? DAY_WIDTH : 0);
  const top = -WINDOW_HEIGHT / 2;
  // Workshops fit a black or white date wheel to suit the dial.
  const darkWheel = isDark(base);
  const wheel = darkWheel ? "#171717" : "#f7f6f1";
  const ink = darkWheel ? "#f0f0eb" : "#161616";
  // Applied dials frame the aperture in metal; printed ones outline it in the print colour.
  const applied = dial.indices === "applied";
  const metal = metalFrom(appliedMetal(print));
  const frame = applied ? (
    <rect
      x={fmt(left - 0.12)}
      y={fmt(top - 0.12)}
      width={fmt(width + 0.24)}
      height={fmt(WINDOW_HEIGHT + 0.24)}
      rx="0.12"
      fill="none"
      stroke={metal.light}
      strokeWidth="0.26"
      filter={url(idFor("applied-shadow"))}
    />
  ) : (
    <rect x={fmt(left)} y={fmt(top)} width={fmt(width)} height={fmt(WINDOW_HEIGHT)} fill="none" stroke={print} strokeWidth="0.1" opacity={0.75} />
  );

  return (
    <g>
      <defs>
        <linearGradient id={idFor("date-shadow")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity={0.45} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={fmt(left)} y={fmt(top)} width={fmt(width)} height={fmt(WINDOW_HEIGHT)} fill={wheel} />
      <g fontFamily={SANS} fontWeight={700} textAnchor="middle">
        <text x={fmt(DATE_CENTRE_X)} y="0" dominantBaseline="central" fontSize="1.3" fill={ink}>
          {SHOWN_DATE}
        </text>
        {dayDate && (
          <text
            x={fmt(left + DAY_WIDTH / 2)}
            y="0"
            dominantBaseline="central"
            fontSize="1.15"
            letterSpacing="0.06"
            fill={darkWheel ? ink : SATURDAY_BLUE}
          >
            {SHOWN_DAY}
          </text>
        )}
      </g>
      {dayDate && (
        <path
          d={`M${fmt(DATE_CENTRE_X - DATE_WIDTH / 2)} ${fmt(top)}V${fmt(-top)}`}
          stroke={applied ? metal.light : print}
          strokeWidth="0.12"
          opacity={0.8}
        />
      )}
      <rect x={fmt(left)} y={fmt(top)} width={fmt(width)} height={fmt(WINDOW_HEIGHT * 0.4)} fill={url(idFor("date-shadow"))} />
      {frame}
    </g>
  );
}

/** Customer's personal line, small capitals above 6 o'clock. */
function DialText({ text, dial, zones, print }: { text: string; dial: Dial; zones: DialZones; print: string }) {
  const line = text.trim().toUpperCase();
  if (!line) return null;
  const { s } = zones;
  const inner = indexInner(dial, zones, print);
  const y = inner * 0.66;
  const fontSize = 1.15 * s;
  const tracking = 0.2 * s;
  // Keep long lines inside the markers: squeeze rather than overflow.
  const available = 2 * Math.sqrt(Math.max(inner * inner - y * y, 0)) * 0.8;
  const estimated = line.length * fontSize * 0.68 + (line.length - 1) * tracking;
  const squeeze = estimated > available ? { textLength: fmt(available), lengthAdjust: "spacingAndGlyphs" as const } : {};
  return (
    <text
      x="0"
      y={fmt(y)}
      fill={print}
      fontFamily={SANS}
      fontWeight={600}
      fontSize={fmt(fontSize)}
      letterSpacing={fmt(tracking)}
      textAnchor="middle"
      dominantBaseline="central"
      {...squeeze}
    >
      {line}
    </text>
  );
}

function ChapterRing({ ring: band, dial, idFor }: { ring: { innerR: number; outerR: number }; dial?: Dial; idFor: IdFor }) {
  const base = dial ? darken(safeHex(dial.colorHex, "#1c1c1c"), 0.05) : "#8f8c86";
  const print = dial ? safeHex(dial.printColorHex, "#f2f2ee") : "#f2f2ee";
  const width = band.outerR - band.innerR;
  const edge = band.outerR - 0.15;
  return (
    <g>
      <defs>
        <radialGradient id={idFor("chapter-slope")} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={fmt(band.outerR)}>
          <stop offset={fmt(band.innerR / band.outerR)} stopColor="#000" stopOpacity={0.3} />
          <stop offset={fmt((band.innerR + width * 0.5) / band.outerR)} stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#fff" stopOpacity={0.1} />
        </radialGradient>
      </defs>
      <path d={ring(band.outerR, band.innerR)} fillRule="evenodd" fill={base} />
      <path d={ring(band.outerR, band.innerR)} fillRule="evenodd" fill={url(idFor("chapter-slope"))} />
      <g stroke={print} fill="none">
        <path d={radialTicks(divisions(60, (i) => i % 5 !== 0), edge, edge - width * 0.36)} strokeWidth="0.1" />
        <path d={radialTicks(divisions(60, (i) => i % 5 === 0), edge, band.innerR + width * 0.22)} strokeWidth="0.26" />
      </g>
      <circle r={fmt(band.innerR)} fill="none" stroke="#000" strokeWidth="0.12" opacity={0.45} />
    </g>
  );
}
