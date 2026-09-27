import type { Dial, HandSet } from "@/domain/types";
import { darken, lighten, lumeDayColor, safeHex } from "./color";
import { circle, fmt, positive, symmetric } from "./geometry";
import { gmtHand, hourHand, minuteHand, secondsHand, type HandShape } from "./handShapes";
import { PLACEHOLDER, url, type IdFor } from "./svg";

/** The classic display time, 10:09:36: the hands frame the dial without covering each other. */
const TIME = { hours: 10, minutes: 9, seconds: 36 };
/** The second time zone shown by the GMT hand: 08:09, pointing at about 4 o'clock. */
const GMT_HOURS = 8;

const minutesFraction = TIME.minutes + TIME.seconds / 60;
const HAND_ANGLES = {
  hour: ((TIME.hours % 12) + minutesFraction / 60) * 30,
  minute: minutesFraction * 6,
  seconds: TIME.seconds * 6,
  gmt: (GMT_HOURS + minutesFraction / 60) * 15,
} as const;

/** How high each hand sits above the dial, which sets how far its shadow falls. */
const SHADOW_OFFSET = { gmt: 0.2, hour: 0.3, minute: 0.42, seconds: 0.55 } as const;

interface HandsLayerProps {
  hands?: HandSet;
  dial?: Dial;
  idFor: IdFor;
}

export function HandsLayer({ hands, dial, idFor }: HandsLayerProps) {
  if (!hands) return <PlaceholderHands dial={dial} />;

  const color = safeHex(hands.colorHex, "#d9dde2");
  const secondsColor = safeHex(hands.secondsColorHex, color);
  const lume = lumeDayColor(hands.lume);
  const lengths = hands.lengthsMm;
  const hourLength = positive(lengths.hour, 8.5);
  const minuteLength = positive(lengths.minute, 12.5);
  const secondsLength = positive(lengths.seconds, 13);
  const gmtLength = hands.includesGmt ? positive(lengths.gmt, minuteLength * 0.95) : undefined;

  const hour = withCollar(hourHand(hands.style, hourLength), 1.0 * (hourLength / 8.5));
  const minute = withCollar(minuteHand(hands.style, minuteLength), 0.78 * (minuteLength / 12.5));

  return (
    <g>
      {gmtLength !== undefined && (
        <Hand
          name="gmt"
          shape={withCollar(gmtHand(gmtLength), 1.3)}
          angle={HAND_ANGLES.gmt}
          color={safeHex(hands.gmtColorHex, color)}
          lume={lume}
          idFor={idFor}
        />
      )}
      <Hand name="hour" shape={hour} angle={HAND_ANGLES.hour} color={color} lume={lume} idFor={idFor} />
      <Hand name="minute" shape={minute} angle={HAND_ANGLES.minute} color={color} lume={lume} idFor={idFor} />
      <Hand
        name="seconds"
        shape={withCollar(secondsHand(hands.style, secondsLength), 0.55)}
        angle={HAND_ANGLES.seconds}
        color={secondsColor}
        lume={lume}
        idFor={idFor}
      />
      <circle r="0.2" fill={darken(secondsColor, 0.45)} />
    </g>
  );
}

/** Adds the round collar that presses onto the movement's pinion. */
function withCollar(shape: HandShape, radius: number): HandShape {
  return { ...shape, body: shape.body + circle(radius) };
}

interface HandProps {
  name: keyof typeof SHADOW_OFFSET;
  shape: HandShape;
  angle: number;
  color: string;
  lume?: string;
  idFor: IdFor;
}

function Hand({ name, shape, angle, color, lume, idFor }: HandProps) {
  const gradientId = idFor(`hand-${name}`);
  const offset = SHADOW_OFFSET[name];
  const rotate = `rotate(${fmt(angle)})`;
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={lighten(color, 0.4)} />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor={darken(color, 0.32)} />
        </linearGradient>
      </defs>
      <g transform={`translate(${fmt(offset * 0.6)} ${fmt(offset)})`} opacity={0.45} filter={url(idFor("blur-hand"))}>
        <path d={shape.body} transform={rotate} fill="#000" />
      </g>
      <g transform={rotate}>
        <path d={shape.body} fill={url(gradientId)} stroke={darken(color, 0.4)} strokeWidth="0.04" />
        {shape.facet && <path d={shape.facet} fill={darken(color, 0.3)} opacity={0.55} />}
        {lume && shape.lume && <path d={shape.lume} fill={lume} />}
        {shape.detail && <path d={shape.detail.d} stroke={color} strokeWidth={fmt(shape.detail.width)} fill="none" />}
      </g>
    </g>
  );
}

/** Outline hands at typical lengths for the dial, when no hand set is chosen. */
function PlaceholderHands({ dial }: { dial?: Dial }) {
  const dialR = positive(dial?.diameterMm, 28.5) / 2;
  const stick = (length: number, width: number, angle: number) => (
    <path
      d={symmetric([
        [width / 2, 0],
        [width / 2, -length],
        [0, -length - width / 2],
      ])}
      transform={`rotate(${fmt(angle)})`}
    />
  );
  return (
    <g {...PLACEHOLDER} fillOpacity={0.7}>
      {stick(dialR * 0.58, 1.3, HAND_ANGLES.hour)}
      {stick(dialR * 0.86, 0.9, HAND_ANGLES.minute)}
      <circle r="0.9" />
    </g>
  );
}
