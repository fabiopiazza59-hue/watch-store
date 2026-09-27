// Assembly instructions for the watchmaker, generated from the actual parts of a spec.
//
// Procedures follow Seiko's NH3x/4R3x instructions and common modding practice. Where practice varies
// between case makers the text says so rather than guessing.
import { CATALOG, dateWheelColour, EXTRAS, resolveExtras, resolveSpec, SLOTS, specExtras } from "./catalog";
import type {
  BomLine,
  BuildSheet,
  BuildStep,
  Catalog,
  CrownPosition,
  Extra,
  Movement,
  Part,
  Personalization,
  QcCheck,
  ResolvedExtras,
  ResolvedSpec,
  SlotDef,
  Strap,
  WatchSpec,
} from "./types";

/**
 * Hands-on bench time in minutes. Pricing charges labour on this same estimate; timegrapher
 * regulation and the pressure test are priced separately as QC.
 */
export const BENCH_MINUTES = {
  /** Check parts in, fit the dial and three hands, case the movement, cut the stem, close up, fit the strap. */
  base: 90,
  /** The NH34's fourth hand and its tighter stack. */
  gmtHand: 20,
  /** Clean the recess, align the marker, bond the insert. */
  bezelInsert: 15,
  /** Proofing, sending out, checking and handling each personalized part. */
  perPersonalization: 10,
  /** Taking out links to the wrist size and fitting the end links. */
  braceletSizing: 15,
  /** Checking a spare strap against the lugs, fitting its spring bars and packing it (a bracelet is sized too). */
  spareStrap: 5,
} as const;

/** Add-ons with a procedure of their own on this sheet (ids from catalog/extras.ts). */
export const EXTRA_PROCEDURE_IDS = {
  fineRegulation: "extra-fine-regulation",
  timingCertificate: "extra-timing-certificate",
  giftWrap: "extra-gift-wrap",
  springBarTool: "extra-spring-bar-tool",
} as const;

/** Fine regulation's promise: the rate dial up (face up), in s/day. Other positions keep the factory spec. */
export const FINE_REGULATION_TARGET_SEC_PER_DAY = 10;

/** One thing the order includes beyond the watch, as the BOM and the price list show it. */
export interface ExtraLine {
  /** The spare strap's id or the add-on's id. */
  id: string;
  /** "Spare strap: Olive NATO 20mm", "Presentation box". */
  label: string;
  costEur: number;
  leadTimeDays: number;
  supplierHint: string;
  /** Bench time it adds, included in `estimateBenchMinutes`. */
  benchMinutes: number;
  /**
   * Bought in for this order, so it arrives as a parcel of its own, like a part: the spare strap and
   * any add-on with a supplier lead time. Add-ons without one come from the workshop's stock or bench.
   */
  parcel: boolean;
}

/** The spare strap first, then each add-on, in the order the extras resolved. */
export function extraLines(extras: ResolvedExtras): ExtraLine[] {
  const strap = extras.spareStrap;
  const spare: ExtraLine[] = strap
    ? [
        {
          id: strap.id,
          label: `Spare strap: ${strap.name}`,
          costEur: strap.costEur,
          leadTimeDays: strap.leadTimeDays,
          supplierHint: strap.supplierHint,
          benchMinutes: BENCH_MINUTES.spareStrap + (strap.type === "bracelet" ? BENCH_MINUTES.braceletSizing : 0),
          parcel: true,
        },
      ]
    : [];
  const items = extras.items.map(
    (extra): ExtraLine => ({
      id: extra.id,
      label: extra.name,
      costEur: extra.costEur,
      leadTimeDays: extra.leadTimeDays,
      supplierHint: extra.supplierHint,
      benchMinutes: extra.benchMinutes,
      parcel: extra.leadTimeDays > 0,
    }),
  );
  return [...spare, ...items];
}

/** Bench minutes the extras add: fitting and packing a spare strap, and each add-on's own time. */
export function extrasBenchMinutes(extras: ResolvedExtras): number {
  return extraLines(extras).reduce((total, line) => total + line.benchMinutes, 0);
}

const NO_EXTRAS_RESOLVED: ResolvedExtras = { items: [] };

export interface PersonalizationService {
  label: string;
  /** Per-unit cost of the bought-in service, EUR excl. VAT. */
  costEur: number;
  /** Days the part is away being printed or engraved before assembly can start. */
  leadTimeDays: number;
  supplierHint: string;
}

/**
 * Personalization is bought in per unit before assembly. Pricing reads these costs too
 * (PRICING_CONFIG.personalization), so this is the one place to update them.
 */
export const PERSONALIZATION_SERVICES = {
  dialText: {
    label: "UV-printed dial text",
    costEur: 18,
    leadTimeDays: 4,
    supplierHint: "UV flatbed printing service (or an in-house UV printer) that prints single dials from a proof.",
  },
  casebackEngraving: {
    label: "Laser-engraved caseback",
    costEur: 12,
    leadTimeDays: 3,
    supplierHint: "Fibre-laser engraving service (or an in-house fibre laser) for steel and titanium casebacks.",
  },
} as const satisfies Record<keyof Personalization, PersonalizationService>;

export interface RequestedPersonalization extends PersonalizationService {
  kind: keyof Personalization;
  text: string;
}

/** The personalization services a spec asks for, with the (trimmed) text for each. */
export function requestedPersonalization(personalization: Personalization): RequestedPersonalization[] {
  return (Object.keys(PERSONALIZATION_SERVICES) as (keyof Personalization)[])
    .map((kind) => ({ kind, ...PERSONALIZATION_SERVICES[kind], text: personalization[kind].trim() }))
    .filter((item) => item.text !== "");
}

export interface SlotPart {
  def: SlotDef;
  /** The id the spec holds for this slot (null for an empty optional slot). */
  id: string | null;
  /** The resolved part; undefined when the id is empty, unknown or of the wrong category. */
  part?: Part;
}

/** Every slot of the spec in build order, with its part resolved from the catalogue. */
export function partsBySlot(spec: WatchSpec, catalog: Catalog = CATALOG): SlotPart[] {
  return SLOTS.map((def) => {
    const id = spec[def.slot];
    const part = id ? (catalog[def.catalogKey] as Part[]).find((candidate) => candidate.id === id) : undefined;
    return { def, id, part };
  });
}

/** Bench minutes for one watch and its extras. Pure; unknown/missing parts simply add nothing. */
export function estimateBenchMinutes(
  parts: ResolvedSpec,
  personalization: Personalization,
  extras: ResolvedExtras = NO_EXTRAS_RESOLVED,
): number {
  return (
    BENCH_MINUTES.base +
    (parts.movement?.complications.includes("gmt") ? BENCH_MINUTES.gmtHand : 0) +
    (parts.bezelInsert ? BENCH_MINUTES.bezelInsert : 0) +
    requestedPersonalization(personalization).length * BENCH_MINUTES.perPersonalization +
    (parts.strap?.type === "bracelet" ? BENCH_MINUTES.braceletSizing : 0) +
    extrasBenchMinutes(extras)
  );
}

/** Timegrapher lift angle for the NH3x family (one source gives 54° for the NH34). */
const LIFT_ANGLE_DEG = 53;

/** Measurement conditions and limits from SII's NH3 technical guide. */
const SII_TIMING = {
  /** Crown turns that fully wind the mainspring. */
  fullWindTurns: 55,
  /** When to measure after a full wind. */
  measureWindow: "10-60 minutes",
  positions: "dial up, 9 o'clock up (crown down) and 6 o'clock up",
  /** The same positions other than dial up. */
  otherPositions: "9 o'clock up (crown down) and 6 o'clock up",
  /** Largest spread between the fastest and slowest of those positions, s/day. */
  maxPostureDifference: 60,
} as const;

/** Beat error the timing check accepts. Adjusting it at the stud carrier is beyond this sheet. */
const MAX_BEAT_ERROR_MS = 0.6;

/** Everything the steps and checks branch on, derived once from the resolved parts. */
interface Build {
  parts: ResolvedSpec;
  dialText: string;
  engraving: string;
  /** The dial shows the movement's date. */
  showsDate: boolean;
  /** The dial shows the movement's day. */
  showsDay: boolean;
  /** The movement has a date wheel the dial hides: the crown gets a setting position that does nothing visible. */
  phantomDate: boolean;
  /** Day-date movement behind a dial without a day window. */
  hiddenDay: boolean;
  isGmt: boolean;
  screwDownCrown: boolean;
  displayBack: boolean;
  bracelet: boolean;
  spare?: Strap;
  fineRegulation: boolean;
  timingCertificate: boolean;
  giftWrap: boolean;
  springBarTool: boolean;
  /** Boxes and pouches, in catalogue order: the first one holds the watch. */
  packaging: Extra[];
  /** Add-ons packed with the watch that no step below handles by name. */
  otherPacked: Extra[];
}

function describeBuild(spec: WatchSpec, parts: ResolvedSpec, extras: ResolvedExtras): Build {
  const { movement, dial } = parts;
  const aperture = dial?.dateWindow ?? "none";
  const hasDay = movement?.complications.includes("day") ?? false;
  const ordered = (id: string) => extras.items.some((extra) => extra.id === id);
  const named = new Set<string>(Object.values(EXTRA_PROCEDURE_IDS));
  return {
    parts,
    dialText: spec.personalization.dialText.trim(),
    engraving: spec.personalization.casebackEngraving.trim(),
    showsDate: Boolean(movement?.hasDateWheel) && aperture !== "none",
    showsDay: hasDay && aperture === "day-date-3",
    phantomDate: Boolean(movement?.hasDateWheel && dial) && aperture === "none",
    hiddenDay: hasDay && Boolean(dial) && aperture !== "day-date-3",
    isGmt: movement?.complications.includes("gmt") ?? false,
    screwDownCrown: parts.case?.screwDownCrown ?? false,
    displayBack: parts.case?.caseback === "display",
    bracelet: parts.strap?.type === "bracelet",
    spare: extras.spareStrap,
    fineRegulation: ordered(EXTRA_PROCEDURE_IDS.fineRegulation),
    timingCertificate: ordered(EXTRA_PROCEDURE_IDS.timingCertificate),
    giftWrap: ordered(EXTRA_PROCEDURE_IDS.giftWrap),
    springBarTool: ordered(EXTRA_PROCEDURE_IDS.springBarTool),
    packaging: extras.items.filter((extra) => extra.kind === "packaging"),
    otherPacked: extras.items.filter((extra) => extra.kind !== "packaging" && extra.kind !== "service" && !named.has(extra.id)),
  };
}

function crownLabel(position: CrownPosition): string {
  if (position === 3.8) return "3.8 o'clock (SKX-style '4 o'clock')";
  return `${position} o'clock`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatAccuracy(movement: Movement): string {
  return `${signed(movement.accuracySecPerDay.min)} to ${signed(movement.accuracySecPerDay.max)} s/day`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** "a, b and c". */
function listJoin(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "Olive NATO 20mm strap", "Steel bracelet 20mm". */
function strapNoun(strap: Strap): string {
  return strap.type === "bracelet" ? strap.name : `${strap.name} strap`;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

interface QuicksetBlackout {
  /** "9 p.m. and 4 a.m." */
  window: string;
  source: string;
}

/**
 * When the crown's quick-set positions must not be used. SII's NH3 technical guide gives 9 p.m. to
 * 4 a.m. for the date on the NH35 and NH36 (and the NH36's day); the NH34 isn't in that guide, and
 * Seiko's 4R34/NH34 instructions give 9 p.m. to 3 a.m. for its date and its 24h hand.
 */
function quicksetBlackout(movement: Movement): QuicksetBlackout | null {
  if (!movement.hasDateWheel) return null;
  if (movement.complications.includes("gmt")) return { window: "9 p.m. and 3 a.m.", source: "Seiko's NH34 instructions" };
  return { window: "9 p.m. and 4 a.m.", source: "SII's NH3 technical guide" };
}

function dayWheelFor(crown: CrownPosition): string {
  if (crown === 3) return "the standard day wheel (for a 3 o'clock crown)";
  if (crown === 3.8) return "the '4 o'clock crown' day wheel (for a 3.8 o'clock crown)";
  return `the day wheel for a ${crownLabel(crown)} crown`;
}

/**
 * What to specify when ordering the movement: the date wheel colour that suits the dial and, for a
 * day-date, the day wheel aligned for the case's crown position. Null when nothing shows through the dial.
 */
function movementVariant({ parts, showsDate, showsDay }: Build): string | null {
  const { dial, case: watchCase } = parts;
  if (!dial || !showsDate) return null;
  const colour = dateWheelColour(dial);
  if (!showsDay) return `with a ${colour} date wheel`;
  return `with ${colour} day and date wheels${watchCase ? ` and ${dayWheelFor(watchCase.crownPosition)}` : ""}`;
}

type Falsy = false | null | undefined | "";

function present<T>(items: (T | Falsy)[]): T[] {
  return items.filter((item): item is T => Boolean(item));
}

function sentences(...parts: (string | Falsy)[]): string {
  return present(parts).join(" ");
}

// ---------------------------------------------------------------------------
// Steps, in bench order. Each returns null when it doesn't apply to this build.
// ---------------------------------------------------------------------------

type StepBuilder = (build: Build) => BuildStep | null;

const printDialText: StepBuilder = ({ dialText, parts }) =>
  dialText
    ? {
        title: "Personalization first: UV-print the dial",
        detail: `Have "${dialText}" UV-printed on the ${parts.dial ? `${parts.dial.name} dial` : "dial"}, centred above 6 o'clock in the dial's print colour. Send it out as soon as the dial arrives: the dial can't go on the movement until the print is back and fully cured.`,
        cautions: [
          "Check the spelling and the centring on the 12-6 axis against the order before printing; a misprint costs a new dial.",
          "Handle the dial by its edge with finger cots and keep the dial feet clear of the print jig: a bent foot won't seat on the movement.",
        ],
      }
    : null;

const engraveCaseback: StepBuilder = ({ engraving, parts }) =>
  engraving
    ? {
        title: "Personalization first: engrave the caseback",
        detail: `Laser-engrave "${engraving}" on the ${parts.case?.name ?? "case"}'s caseback. Take the caseback gasket out and engrave the bare caseback, then clean off any residue before it goes anywhere near the movement.`,
        cautions: [
          "If the caseback screws down, it stops at a slightly different angle each time it's tightened, so text meant to read upright can end up rotated. Engrave centred or around the rim, or trial-close the caseback on the empty case and mark 12 o'clock first.",
          "Check the text against the order before engraving; there is no undo.",
        ],
      }
    : null;

const checkPartsIn: StepBuilder = (build) => {
  const { parts } = build;
  const { case: watchCase, dial, crystal, hands, movement } = parts;
  const variant = movementVariant(build);
  const withNotes = Object.values(parts).some((part) => part?.dataNotes);
  const holes = hands && `${hands.holesMm.hour}/${hands.holesMm.minute}/${hands.holesMm.seconds}${hands.holesMm.gmt ? `/${hands.holesMm.gmt}` : ""}mm`;
  return {
    title: "Check the parts in against this sheet",
    detail: sentences(
      "Tick off every line of the bill of materials.",
      Boolean(watchCase && dial) && `Measure the dial with calipers: ${dial?.diameterMm}mm, for a ${watchCase?.dialDiameterMm}mm dial seat.`,
      Boolean(watchCase && crystal) && `The crystal should be ${crystal?.diameterMm}mm for the ${watchCase?.crystalDiameterMm}mm crystal seat.`,
      Boolean(holes) && `Check the hand holes on the packet: ${holes} (hour/minute/seconds${hands?.holesMm.gmt ? "/24h" : ""}).`,
      Boolean(dial && parts.movement?.handHolesMm.gmt) &&
        `Measure the dial's centre hole: it should be about ${dial?.centerHoleMm}mm, wide enough for the 24-hour wheel. A standard 2.05mm hole won't go over it.`,
      Boolean(movement && variant) && `Check the ${movement?.caliber} came ${variant}.`,
    ),
    cautions: present([
      withNotes &&
        "Some values in the notes on these parts, under the parts list, are estimates or single-source: measure those parts now and correct the catalogue if they differ.",
      "If the crystal arrives already fitted in the case, leave it there; a well-seated crystal already proves the size.",
    ]),
  };
};

const testMovement: StepBuilder = ({ parts, displayBack }) => {
  const { movement } = parts;
  if (!movement) return null;
  return {
    title: `Test the ${movement.caliber} before assembly`,
    detail: `Wind the bare movement fully by the stem (at least ${SII_TIMING.fullWindTurns} turns, as SII specifies) and, ${SII_TIMING.measureWindow} later, put it on the timegrapher at ${movement.beatRateVph.toLocaleString("en-US")} vph, lift angle ${LIFT_ANGLE_DEG}°. Note rate, amplitude and beat error ${SII_TIMING.positions}. This baseline tells you later whether a fault came with the movement or from assembly.`,
    cautions: present([
      "Keep the movement in its holder and wear finger cots from here on.",
      displayBack && "This watch has a display caseback: a fingerprint on the rotor or bridges will be on show for good.",
      "If the rate jumps around or is far out, demagnetise the movement before suspecting a fault.",
      `If the beat error is already over ${MAX_BEAT_ERROR_MS} ms, the movement came that way: return or replace it rather than building it in.`,
    ]),
  };
};

const prepareCase: StepBuilder = ({ parts }) => {
  const { case: watchCase, crystal } = parts;
  if (!watchCase) return null;
  const domed = crystal && crystal.shape !== "flat";
  return {
    title: "Prepare the case",
    detail: sentences(
      `Clean the ${watchCase.name} inside and out with the blower and rodico.`,
      crystal &&
        (domed
          ? `If the ${crystal.name} crystal isn't already fitted, press it into the crystal seat with its gasket using the case press, a flat support die under the case and a hollow (ring) die on top whose straight inner wall rests only on the crystal's outer edge, never on the dome. Press evenly.`
          : `If the ${crystal.name} crystal isn't already fitted, press it into the crystal seat with its gasket, using the case press and flat nylon dies and pressing evenly.`),
    ),
    cautions: present([
      domed && "Never press a domed crystal with a flat die: it bears on the top of the dome and loads the brittle centre, which can crack it.",
      crystal &&
        crystal.arCoating !== "none" &&
        `The crystal has anti-reflective coating on ${crystal.arCoating === "both" ? "both sides" : "the inside"}, which marks easily: clean it with the blower and rodico, not tissue.`,
      "Check the crystal gasket is seated all the way round; a pinched gasket fails the pressure test later.",
    ]),
  };
};

const fitDial: StepBuilder = ({ parts, showsDate, showsDay, phantomDate, isGmt }) => {
  const { dial, case: watchCase } = parts;
  if (!dial) return null;
  const crown = crownLabel(watchCase?.crownPosition ?? dial.crownPosition);
  return {
    title: "Fit the dial",
    detail: sentences(
      phantomDate &&
        "This dial has no date window, so the movement's date disc will be hidden underneath it. Before the dial goes on, pull the stem to the time-setting position (second click) and turn it slowly forwards until the date just snaps over: that is midnight. Leave the stem where it is until the hands are on.",
      `The NH3x has no dial screws or clamps: the dial's two feet are a friction fit in the holes of the movement's dial spacer ring. The ${dial.name} dial is footed for a ${crown} crown; if it came with four feet, clip off the pair for the other crown position.`,
      "Line the feet up with their holes and press the dial down evenly at its edge until it sits flat.",
      isGmt && "The NH34 needs a GMT dial with an enlarged centre hole (about 2.7-2.9mm) to clear its 24h pinion: check it clears before you press.",
      showsDate && "Check the date sits centred in the window before going further.",
      showsDay && "Check the day sits level and centred too. A crooked day means the NH36 day-wheel variant doesn't match this case's crown position: sort it out now.",
    ),
    cautions: [
      "Never press on a foot that isn't in its hole: it bends the foot or dents the dial.",
      "Dial dots (adhesive pads) are the fallback if the feet don't match, but then 12 o'clock has to be aligned by eye.",
      "Blow the dial clean before it goes on; dust caught under the crystal means taking everything apart again.",
    ],
  };
};

const fitHands: StepBuilder = ({ parts, isGmt, phantomDate }) => {
  const { hands, movement, case: watchCase } = parts;
  if (!hands) return null;
  const hasDateWheel = movement?.hasDateWheel ?? true;
  const gmtHole = movement?.handHolesMm.gmt ?? hands.holesMm.gmt;
  const timing = !hasDateWheel
    ? `The ${movement?.caliber ?? "movement"} has no date to time against, so fit the hands at 12 with the stem in the time-setting position.`
    : phantomDate
      ? "The date is hidden under this dial, and the movement was left at midnight before the dial went on: with the stem still in the time-setting position, fit the hands at 12, so the hidden date still changes at midnight rather than at noon."
      : "Pull the stem to the time-setting position (second click) and turn it slowly forwards until the date just snaps over to the next day: that is midnight. The hands go on at 12 in this position, so the date will change at midnight rather than at noon.";
  return {
    title: isGmt ? "Fit the four hands" : "Fit the hands",
    detail: sentences(
      "Lay the dial protector over the dial.",
      timing,
      isGmt &&
        `Press the 24h hand first: it has the largest hole${gmtHole ? ` (${gmtHole}mm)` : ""} and sits on the outermost, lowest pinion, just above the dial. Point it exactly at 24 (straight up).`,
      `Press the hour hand at 12, then the minute hand at 12.`,
      movement?.hacking === false
        ? "Press the seconds hand last, pointing at 12."
        : "With the stem still pulled out, the seconds are stopped: press the seconds hand last, pointing at 12.",
      "Use flat nylon tips and moderate pressure, about what you'd use writing with a pen, and check from the side after each hand that it sits level with an even gap to the one below.",
    ),
    cautions: present([
      "Don't press the seconds hand until it's centred on its pinion: it's the easiest hand to bend and its pinion the easiest to damage.",
      "If a hand goes on crooked or at the wrong height, lift it off with hand levers over the dial protector; don't press harder.",
      hands.lume !== "none" && "Pick lumed hands up by the collet, not the lume: pressure on the lume can crack it off.",
      isGmt &&
        "The 24h hand moves in one-hour jumps, so if it's pressed between markers every setting will be off by the same amount.",
      isGmt &&
        watchCase &&
        `The NH34 stack is about 0.4mm taller than a three-hander, and this case allows an estimated ${watchCase.handClearanceMm}mm above the dial. A bench hand press with interchangeable tips makes the four-hand stack much easier.`,
    ]),
  };
};

const checkBeforeCasing: StepBuilder = ({ parts, showsDate, showsDay, isGmt }) => {
  const blackout = parts.movement && quicksetBlackout(parts.movement);
  return {
    title: showsDate ? "Check clearances and the calendar before casing" : "Check hand clearances before casing",
    detail: sentences(
      "Turn the hands forwards slowly through a full 24 hours (two turns of the hour hand), watching from the side: no hand may touch another hand, the dial or the indices.",
      showsDate && "The date should snap over at midnight and at no other time.",
      showsDay && "Seiko's spec for this calibre: the date changes around midnight and the day around 4 a.m.",
      isGmt &&
        `Then turn the hands on to about 6 o'clock, six hours past the date change and well clear of the no-quick-set window${blackout ? ` (between ${blackout.window})` : ""}. Only then pull the stem to the first position and turn it clockwise, as you would the crown: the 24h hand should jump one hour per step and land exactly on each marker.`,
    ),
    cautions: present([
      "Fix any rubbing now. Once cased, the only way back is through the whole stack.",
      blackout &&
        `Never use the ${isGmt ? "date or 24h-hand" : "calendar"} quick-set between ${blackout.window} (${blackout.source}): it can stop the date changing or damage the mechanism.`,
    ]),
  };
};

const caseMovement: StepBuilder = ({ parts }) => {
  const { case: watchCase } = parts;
  if (!watchCase) return null;
  return {
    title: "Case the movement",
    detail: sentences(
      "Take the stem out: with it pushed fully in (the winding position), press the setting-lever release beside the stem on the back of the movement with pegwood and slide the stem out. The release only works in that position.",
      "Fit the movement spacer ring your case maker specifies and blow the dial and crystal clean one last time.",
      `Bring the movement and case together, dial towards the crystal, with the stem hole lined up with the crown tube at ${crownLabel(watchCase.crownPosition)}.`,
      "Push the stem back in through the tube until it clicks home.",
    ),
    cautions: [
      "Never force the release or the stem. If it won't move, check the stem is pushed fully in.",
      "Cases differ in how they hold the movement (spacer ring alone, clamps or screws): follow your case maker's instructions.",
      "Anything that falls into the case now ends up under the crystal: work dial-down over a clean surface.",
    ],
  };
};

const fitCrown: StepBuilder = ({ screwDownCrown, parts }) => {
  if (!parts.case) return null;
  return {
    title: screwDownCrown ? "Cut the stem and fit the screw-down crown" : "Cut the stem and fit the crown",
    detail: sentences(
      "New stems come full length.",
      "Screw the crown onto the uncut stem, fit it into the movement, and measure with calipers from the end of the crown tube to the base of the crown head: that is roughly how much to take off.",
      "Mark the stem, cut it with a stem cutter or flush pliers while holding it in a pin vice, file the end so it threads cleanly, and test-fit. Cut a little at a time.",
      screwDownCrown
        ? "It's right when, pushed in, the crown catches the tube threads and screws fully down while the stem stays in the winding position. Aim for every function working with a thread or two to spare, then take the stem down gradually. Too long and the crown won't screw all the way down; too short and it screws down but winding and setting don't engage properly."
        : "It's right when the base of the crown sits just clear of the end of the tube with the stem in the winding position.",
      "When the length is right, thread-lock the stem into the crown and let it cure for a few hours before relying on it.",
    ),
    cautions: present([
      "You can't add length back: budget a spare stem (Seiko part 351-200) while you're learning.",
      "Check the crown's gasket is present and give it a trace of silicone grease.",
      screwDownCrown &&
        "Start the crown on the tube by hand, turning it backwards until you feel the thread drop in: a cross-threaded tube ruins the case's water resistance.",
    ]),
  };
};

const regulate: StepBuilder = ({ parts, isGmt }) => {
  const { movement } = parts;
  if (!movement) return null;
  return {
    title: "Time and regulate",
    detail: sentences(
      `With the caseback still off, wind fully (at least ${SII_TIMING.fullWindTurns} turns) and, ${SII_TIMING.measureWindow} later, put the watch on the timegrapher (${movement.beatRateVph.toLocaleString("en-US")} vph, lift angle ${LIFT_ANGLE_DEG}°).`,
      `Measure ${SII_TIMING.positions}, SII's three test positions; all six if you have time.`,
      `The factory spec is ${formatAccuracy(movement)} in each position, with no more than ${SII_TIMING.maxPostureDifference} s/day between the fastest and the slowest; careful regulation can usually get well inside that.`,
      `Healthy amplitude fully wound is about 250-310°, and beat error should be under ${MAX_BEAT_ERROR_MS} ms.`,
      "Nudge the regulator lever towards + or - by half a division at a time and re-measure after each move.",
    ),
    cautions: present([
      "The NH3x regulator is very sensitive: move it a hair at a time.",
      "Low amplitude or an erratic trace is not a regulation problem. Look for a hand touching, dust or a damaged movement before going further.",
      `Beat error is set at the stud carrier, which is advanced work: leave it alone while you're learning. If it's over ${MAX_BEAT_ERROR_MS} ms and the baseline test showed it too, the movement came that way: return or replace it.`,
      isGmt && "Some sources give 54° as the NH34's lift angle. It changes the amplitude reading slightly, not the rate.",
    ]),
  };
};

const fineRegulate: StepBuilder = ({ parts, fineRegulation }) => {
  const { movement } = parts;
  if (!fineRegulation || !movement) return null;
  const target = FINE_REGULATION_TARGET_SEC_PER_DAY;
  return {
    title: "Fine regulation (ordered)",
    detail: sentences(
      `The customer ordered fine regulation: a second, slower session on the timegrapher, aiming for the rate dial up (face up) within -${target} to +${target} s/day.`,
      `Wait about 15 minutes after the last adjustment, make sure the watch is still well wound (at least ${SII_TIMING.fullWindTurns} turns from empty), and take readings dial up only once the trace has settled, a minute or more each.`,
      "Adjust the rate only, with the regulator lever, in the smallest movements you can make, and re-measure after each one.",
      "Aim for the middle of the target, not its edge, so the small shift that casing up and the run-in can bring keeps it inside.",
      `When it's there, measure ${SII_TIMING.otherPositions} as well and record them as they are, with the dial-up rate, amplitude and beat error, on the order.`,
    ),
    cautions: [
      `Don't chase the other positions with the regulator: the promise is dial up only, and the difference between positions is the movement's own. They stay within the factory spec of ${formatAccuracy(movement)}.`,
      "Leave the beat error alone (it's set at the stud carrier): fine regulation is the rate only.",
      `If the rate won't hold within ±${target} s/day dial up, or the amplitude is low, look for the cause (a rubbing hand, magnetism, a tired movement) rather than pushing the regulator further, and don't ship it as finely regulated until it passes.`,
      "The final QC measures dial up again after the run-in. If the rate has left the target by then, open the caseback, adjust, and repeat the pressure test.",
    ],
  };
};

const closeCaseback: StepBuilder = ({ displayBack, engraving, parts }) => {
  if (!parts.case) return null;
  return {
    title: displayBack ? "Close the display caseback" : "Close the caseback",
    detail: sentences(
      "Check the caseback gasket is undamaged and sitting in its groove, and give it a thin, even film of silicone grease.",
      displayBack && "Take a last look at the movement: dust or a fingerprint under the display window will be on show for good.",
      "With the case in a holder, close a screw-down caseback with the caseback wrench (tips set firmly in the notches), or a press-fit one with the case press and matching dies.",
      engraving && "Check the engraving has ended up where you planned.",
    ),
    cautions: [
      "Use silicone grease only: petroleum-based greases attack rubber gaskets.",
      "Too much grease collects dust and can stop the gasket seating; a thin film is enough.",
      "A slipping wrench gouges the caseback: tighten firmly, not with brute force.",
    ],
  };
};

const fitBezelInsert: StepBuilder = ({ parts }) => {
  const { bezelInsert, case: watchCase } = parts;
  if (!bezelInsert) return null;
  const reference = watchCase?.chapterRing ? "12 on the chapter ring" : "12 on the dial";
  const marker = bezelInsert.scale === "gmt-24" ? "24 marker" : "12 o'clock marker";
  return {
    title: "Fit the bezel insert",
    detail: sentences(
      "Most aftermarket inserts are bonded with an adhesive ring rather than pressed in.",
      "With the bezel on the case, clean its insert recess with alcohol on a swab, lifting any old adhesive with pegwood.",
      `Let the bezel rest in a click, dry-fit the ${bezelInsert.name} insert (${bezelInsert.outerMm} x ${bezelInsert.innerMm}mm) so its ${marker} lines up with ${reference}, then peel the backing, line it up again and press it down firmly for a few seconds.`,
    ),
    cautions: present([
      "Align it with the bezel resting in a click, not between two, or the marker will never sit exactly over 12.",
      "Some inserts are a friction fit instead: check the insert maker's instructions.",
      bezelInsert.material === "ceramic" && "Ceramic is brittle: press with a thumb or a flat nylon die, never metal.",
    ]),
  };
};

const pressureTest: StepBuilder = ({ parts, screwDownCrown }) => {
  const { case: watchCase } = parts;
  if (!watchCase) return null;
  const bar = watchCase.waterResistanceM / 10;
  return {
    title: "Pressure test",
    detail: `Test before the strap goes on. The case is rated ${watchCase.waterResistanceM}m, which is ${bar} bar: dry-test it at ${bar} bar. A test at a lower pressure is not a pass: if your tester can't reach ${bar} bar, have the watch tested on one that can before it ships.`,
    cautions: present([
      watchCase.waterResistanceEstimated &&
        `The case maker hasn't confirmed the ${watchCase.waterResistanceM}m rating in writing: confirm it before testing, and never test above the rating the maker confirms.`,
      screwDownCrown ? "Screw the crown fully down before testing." : "Push the crown fully in before testing.",
      "If it fails, check the usual suspects in turn: crown and crown gasket, caseback gasket, crystal gasket.",
    ]),
  };
};

const setAndFitStrap: StepBuilder = ({ parts, showsDate, showsDay, isGmt, bracelet }) => {
  const { movement, strap, case: watchCase } = parts;
  const blackout = movement && quicksetBlackout(movement);
  const quickset = present([
    showsDate && "counter-clockwise sets the date",
    showsDay && "clockwise sets the day",
    isGmt && "clockwise moves the 24h hand",
  ]).join(", ");
  const fittedEndLinks = Boolean(strap?.compatibleCaseIds?.length);
  return {
    title: bracelet ? "Size the bracelet and set the watch" : "Set the watch and fit the strap",
    detail: sentences(
      quickset && blackout
        ? `Wind it and set the hands to 6 o'clock, well clear of the no-quick-set window (between ${blackout.window}). In the first crown position, ${quickset}. Then set the final time, making sure a.m. and p.m. are right: the date changes at midnight.`
        : "Wind it and set the time.",
      bracelet &&
        "Take links out to the customer's wrist size (ask if it isn't in the order notes), evenly from both sides of the clasp so the clasp stays centred.",
      fittedEndLinks && "The bracelet's solid end links are made for this case: fit them on their spring bars and check they sit flush against it.",
      strap?.type === "nato" && "Fit spring bars in the lugs and thread the NATO under them.",
      strap &&
        strap.type !== "nato" &&
        !fittedEndLinks &&
        `Fit the ${strap.name} with its spring bars (or quick-release pins).`,
    ),
    cautions: present([
      "A spring bar that isn't fully seated lets go under load: pull-test both ends.",
      watchCase?.finish.includes("polished") && "Guard the polished lugs from the spring-bar tool; a slip leaves a scratch.",
    ]),
  };
};

const checkSpareStrap: StepBuilder = ({ spare, parts }) => {
  if (!spare) return null;
  const watchCase = parts.case;
  const fittedEndLinks = Boolean(spare.compatibleCaseIds?.length);
  const lugs = watchCase ? `, the ${watchCase.name}'s lug width` : "";
  return {
    title: "Check the spare strap",
    detail: sentences(
      `The order includes a spare ${strapNoun(spare)}. Measure it at the lug end with calipers: it should be ${spare.widthMm}mm${lugs}.`,
      spare.type === "nato"
        ? "Thread it under the watch's spring bars to check it slides through without catching, then take it off again: a NATO needs no spring bars of its own."
        : "Offer it up between the lugs: it should fill the gap with no play and without forcing. Fit its spring bars (or check its quick-release pins) so the customer can swap it straight on.",
      fittedEndLinks && "Its solid end links are made for this case: fit it briefly to check they sit flush against the case, then refit the watch's own strap and pull-test both ends again.",
      spare.type === "bracelet" &&
        "Size it to the customer's wrist as for a bracelet on the watch (ask if the size isn't in the order notes), and pack the links you take out with it.",
      "Set it aside for packing.",
    ),
    cautions: present([
      "A spare that won't seat without forcing is the wrong width: check the measurement against the order instead of forcing it.",
      watchCase?.finish.includes("polished") && "Guard the polished lugs from the spring-bar tool; a slip leaves a scratch.",
    ]),
  };
};

const runIn: StepBuilder = () => ({
  title: "Run-in and final QC",
  detail: "Fully wind the watch and leave it running for 24 hours, then work through every QC check below and record the results on the order before it ships.",
  cautions: ["A watch that fails a check goes back to the step the problem came from. Note what you fixed on the order."],
});

const fillTimingCertificate: StepBuilder = ({ timingCertificate }) =>
  timingCertificate
    ? {
        title: "Fill in the timing certificate",
        detail: sentences(
          "The customer ordered a timing certificate. Once the watch has passed the final QC, copy that check's timegrapher readings onto the card: the date of the test, the rate in each position measured, the amplitude and the beat error, and the result of the 24-hour run.",
          `Note how they were taken: fully wound, ${SII_TIMING.measureWindow} after winding, lift angle ${LIFT_ANGLE_DEG}°.`,
          "Sign and date the card.",
        ),
        cautions: [
          "Write the readings exactly as measured, never rounded towards a target: the card is a record of this watch, not a promise.",
          "Take them from the final QC, cased and after the run-in, not from the regulation session with the caseback off.",
        ],
      }
    : null;

const packOrder: StepBuilder = ({ spare, packaging, springBarTool, timingCertificate, giftWrap, otherPacked }) => {
  const [holder, ...otherPackaging] = packaging;
  const items = present([
    holder && `the watch in the ${lowerFirst(holder.name)}`,
    ...otherPackaging.map((extra) => `the ${lowerFirst(extra.name)}`),
    spare && `the spare ${strapNoun(spare)}${springBarTool ? " with the spring-bar tool" : ""}`,
    springBarTool && !spare && "the spring-bar tool",
    timingCertificate && "the signed timing certificate",
    ...otherPacked.map((extra) => `the ${lowerFirst(extra.name)}`),
  ]);
  if (items.length === 0 && !giftWrap) return null;
  return {
    title: giftWrap ? "Pack and gift-wrap the order" : "Pack the order",
    detail: sentences(
      items.length > 0 && `Pack ${listJoin(items)}.`,
      giftWrap &&
        `Wrap ${items.length > 0 ? "it" : "the watch's box"} by hand and add the card, handwritten with the message the customer confirmed by email.`,
      "Then pack it for shipping so nothing can move in transit.",
    ),
    cautions: present([
      giftWrap &&
        "The card message isn't part of the order: confirm the card message with the customer by email, and write the card only once they've replied.",
      giftWrap && "Keep the price and the order papers out of the wrapped gift; they go in the shipping carton.",
      spare && "Pack the spare so its spring bars can't work loose or rub against the watch.",
    ]),
  };
};

const STEPS: StepBuilder[] = [
  printDialText,
  engraveCaseback,
  checkPartsIn,
  testMovement,
  prepareCase,
  fitDial,
  fitHands,
  checkBeforeCasing,
  caseMovement,
  fitCrown,
  regulate,
  fineRegulate,
  closeCaseback,
  fitBezelInsert,
  pressureTest,
  setAndFitStrap,
  checkSpareStrap,
  runIn,
  fillTimingCertificate,
  packOrder,
];

// ---------------------------------------------------------------------------
// QC checks, with acceptance criteria taken from the parts' own data.
// ---------------------------------------------------------------------------

/** The timekeeping criterion: the factory spec, or with fine regulation its dial-up target and the spec elsewhere. */
function rateCriterion(movement: Movement, fineRegulation: boolean): string {
  const conditions = `measured ${SII_TIMING.measureWindow} after a full wind (lift angle ${LIFT_ANGLE_DEG}°), with no more than ${SII_TIMING.maxPostureDifference} s/day between the fastest and the slowest position; amplitude 250-310°, beat error under ${MAX_BEAT_ERROR_MS} ms.`;
  if (!fineRegulation) return `${formatAccuracy(movement)} ${SII_TIMING.positions}, ${conditions}`;
  const target = FINE_REGULATION_TARGET_SEC_PER_DAY;
  return (
    `Dial up within -${target} to +${target} s/day (fine regulation was ordered); ${SII_TIMING.otherPositions} within the factory spec of ` +
    `${formatAccuracy(movement)}, as positional differences aren't adjusted. All ${conditions}`
  );
}

function qcChecks(build: Build): QcCheck[] {
  const { parts, showsDate, showsDay, isGmt, displayBack, bracelet, screwDownCrown, dialText, engraving } = build;
  const { spare, fineRegulation, timingCertificate } = build;
  const { movement, case: watchCase, dial, hands } = parts;
  const rotatingBezel = watchCase?.bezel === "unidirectional-120" || watchCase?.bezel === "bidirectional-24h";
  const lumed = (dial && dial.lume !== "none") || (hands && hands.lume !== "none");
  const packed = packedItems(build);

  return present<QcCheck>([
    movement && {
      id: "qc-rate",
      label: "Timekeeping",
      criterion: rateCriterion(movement, fineRegulation),
    },
    movement && {
      id: "qc-run-in",
      label: "24-hour run",
      criterion: `Still running 24 h after a full wind (reserve ${movement.powerReserveHours} h), with the day's deviation inside ${formatAccuracy(movement)}.`,
    },
    {
      id: "qc-hand-clearance",
      label: "Hand clearance",
      criterion: sentences(
        "Through a full 24 h no hand touches another hand, the dial, the indices or the crystal; seen from the side the hands sit level with even gaps.",
        isGmt &&
          watchCase &&
          `The four-hand stack has an estimated ${watchCase.handClearanceMm}mm in this case: check the seconds hand against the crystal especially.`,
      ),
    },
    {
      id: "qc-hand-alignment",
      label: "Hand alignment",
      criterion: "Checked at 12, 3, 6 and 9: when the hour hand is exactly on the marker, the minute hand is exactly on 12.",
    },
    showsDate && {
      id: "qc-date-change",
      label: showsDay ? "Day and date change" : "Date change",
      criterion: sentences(
        "The date snaps over at midnight (hands at 12, a few minutes either side is normal), not at noon, and sits centred in the window.",
        showsDay && "The day follows by about 4 a.m. and sits level in its window.",
      ),
    },
    isGmt && {
      id: "qc-gmt",
      label: "GMT hand",
      criterion: `Jumps exactly one hour per click in the first crown position and lands on every 24h marker; synced to local time it reads the same hour as the hour hand on the ${dial?.has24hScale ? "dial's 24h scale" : "24h bezel"}.`,
    },
    movement && {
      id: "qc-crown",
      label: "Crown",
      criterion: sentences(
        screwDownCrown
          ? "Screws fully down by hand with a clean thread start, without pulling the stem out of the winding position."
          : "Sits just clear of the tube when pushed in.",
        "Every crown position clicks positively.",
        movement.handWinding && "Winds smoothly in the winding position.",
        movement.hacking && "The seconds hand stops in the time-setting position.",
      ),
    },
    watchCase && {
      id: "qc-water",
      label: "Water resistance",
      criterion: `No leak when tested at ${watchCase.waterResistanceM / 10} bar (the case's ${watchCase.waterResistanceM}m rating). A test at a lower pressure doesn't pass this check.`,
    },
    watchCase?.bezel === "unidirectional-120" && {
      id: "qc-bezel",
      label: "Bezel action",
      criterion: "Turns counter-clockwise only, exactly 120 clicks per full turn, and the 12 o'clock marker rests exactly over 12.",
    },
    watchCase?.bezel === "bidirectional-24h" && {
      id: "qc-bezel",
      label: "Bezel action",
      criterion: "Turns both ways with positive clicks, and 24 rests exactly over 12.",
    },
    {
      id: "qc-dust",
      label: "Dust and finish",
      criterion: sentences(
        displayBack
          ? "No dust, lint or fingerprints on the dial, hands, inside of the crystal or the movement behind the display caseback, under a 10x loupe."
          : "No dust, lint or fingerprints on the dial, hands or inside of the crystal, under a 10x loupe.",
        rotatingBezel ? "No marks on the case, bezel or crystal." : "No marks on the case or crystal.",
      ),
    },
    lumed && {
      id: "qc-lume",
      label: "Lume",
      criterion: "After charging under a bright light, the dial and hands glow evenly with no missing patches.",
    },
    {
      id: "qc-strap",
      label: bracelet ? "Bracelet" : "Strap",
      criterion: bracelet
        ? "Spring bars fully seated at both ends (pull-tested); sized to the wrist with the clasp centred and closing securely."
        : "Spring bars fully seated at both ends (pull-tested); strap and buckle undamaged.",
    },
    dialText && {
      id: "qc-dial-text",
      label: "Dial text",
      criterion: `Reads exactly "${dialText}", centred above 6 o'clock, crisp and fully cured.`,
    },
    engraving && {
      id: "qc-engraving",
      label: "Caseback engraving",
      criterion: `Reads exactly "${engraving}", clean and legible, with no burrs.`,
    },
    spare && {
      id: "qc-spare-strap",
      label: "Spare strap",
      criterion: sentences(
        `Measures ${spare.widthMm}mm${watchCase ? `, the case's lug width,` : ""} and sits between the lugs with no play and without forcing.`,
        spare.type === "nato" ? "Threads cleanly under the spring bars." : "Its spring bars are fitted and spring back fully.",
        Boolean(spare.compatibleCaseIds?.length) && "Its end links sit flush against the case.",
        "Undamaged, and packed for the customer.",
      ),
    },
    timingCertificate && {
      id: "qc-timing-certificate",
      label: "Timing certificate",
      criterion: "Filled in with the final QC's readings (date, rate in each position measured, amplitude, beat error, 24-hour run), matching the order's record, and signed.",
    },
    packed.length > 0 && {
      id: "qc-contents",
      label: "Order contents",
      criterion: `Packed with ${listJoin(packed)}${build.giftWrap ? ", gift-wrapped, with the card written as the customer confirmed by email" : ""}.`,
    },
  ]);
}

/** What goes in the box besides the watch, for the contents check. */
function packedItems({ spare, packaging, springBarTool, timingCertificate, otherPacked }: Build): string[] {
  return present([
    ...packaging.map((extra) => `the ${lowerFirst(extra.name)}`),
    spare && `the spare ${strapNoun(spare)}`,
    springBarTool && "the spring-bar tool",
    timingCertificate && "the signed timing certificate",
    ...otherPacked.map((extra) => `the ${lowerFirst(extra.name)}`),
  ]);
}

// ---------------------------------------------------------------------------
// BOM, tools and notes
// ---------------------------------------------------------------------------

function billOfMaterials(
  slots: SlotPart[],
  personalization: Personalization,
  movementOrder: string | null,
  extras: ResolvedExtras,
): BomLine[] {
  const partLines = slots.flatMap(({ def, part }): BomLine[] => {
    if (!part) return [];
    const name = part.category === "movement" && movementOrder ? `${part.name}, ${movementOrder}` : part.name;
    return [{ slot: def.slot, partId: part.id, name, qty: 1, unitCostEur: part.costEur, supplierHint: part.supplierHint }];
  });
  const serviceLines = requestedPersonalization(personalization).map(
    (service): BomLine => ({
      slot: "personalization",
      partId: null,
      name: `${service.label}: "${service.text}"`,
      qty: 1,
      unitCostEur: service.costEur,
      supplierHint: service.supplierHint,
    }),
  );
  const extrasLines = extraLines(extras).map(
    (line): BomLine => ({
      slot: "extra",
      partId: line.id,
      name: line.label,
      qty: 1,
      unitCostEur: line.costEur,
      supplierHint: line.supplierHint,
    }),
  );
  return [...partLines, ...serviceLines, ...extrasLines];
}

function toolsFor({ parts, isGmt, bracelet, spare, giftWrap }: Build): string[] {
  const { movement, case: watchCase, bezelInsert, crystal } = parts;
  return present([
    "Movement holder for NH3x movements",
    isGmt
      ? "Hand press with flat nylon tips (a bench press with interchangeable tips is strongly recommended for the four-hand stack)"
      : "Hand press (hand-setting tool) with flat nylon tips",
    "Hand levers, for lifting a hand that goes on wrong",
    "Dial protector sheet",
    "Case press with nylon dies (crystal, press-fit casebacks)",
    crystal && crystal.shape !== "flat" && "Hollow (ring) crystal-press die sized to the crystal's edge, for the domed crystal",
    "Caseback wrench and case holder, for screw-down casebacks",
    "Rodico cleaning putty",
    "Finger cots or nitrile gloves",
    "Hand air blower",
    "Loupe, 5-10x",
    "Fine tweezers with brass or plastic tips",
    "Pegwood or a toothpick",
    "Digital calipers (0.01mm)",
    "Stem cutter or flush-cut pliers, pin vice and a fine file",
    "Thread-locker for the crown-to-stem thread",
    "Silicone grease for gaskets",
    movement
      ? `Timegrapher (${movement.beatRateVph.toLocaleString("en-US")} vph, lift angle ${LIFT_ANGLE_DEG}°)`
      : "Timegrapher",
    "Demagnetiser",
    watchCase ? `Pressure tester that reaches ${watchCase.waterResistanceM / 10} bar (the case's rating)` : "Pressure tester",
    "Spring-bar tool",
    (bracelet || spare?.type === "bracelet") && "Bracelet link tool (pin pusher or fine screwdrivers, to suit the link pins)",
    bezelInsert && "Isopropyl alcohol and lint-free swabs",
    giftWrap && "Wrapping paper, ribbon and a blank card",
  ]);
}

/** Extras the spec asks for that the catalogues don't have, as note phrases. */
function unknownExtras(spec: WatchSpec, extras: ResolvedExtras): string[] {
  const { spareStrapId, itemIds } = specExtras(spec);
  const spare = spareStrapId && !extras.spareStrap ? [`spare strap '${spareStrapId}' is not in the catalogue`] : [];
  const items = [...new Set(itemIds)]
    .filter((id) => !EXTRAS.some((extra) => extra.id === id))
    .map((id) => `add-on '${id}' is not in the catalogue`);
  return [...spare, ...items];
}

function notesFor(build: Build, slots: SlotPart[], unknown: string[]): string[] {
  const { parts, phantomDate, hiddenDay } = build;
  const missing = slots
    .filter(({ def, id, part }) => !part && !(def.optional && !id))
    .map(({ def, id }) => (id ? `${def.label.toLowerCase()} '${id}' is not in the catalogue` : `no ${def.label.toLowerCase()} chosen`));
  const problems = [...missing, ...unknown];
  const dataNotes = slots.flatMap(({ part }) => (part?.dataNotes ? [`${part.name}: ${part.dataNotes}`] : []));
  return present([
    problems.length > 0 && `Not buildable as specified: ${problems.join("; ")}. Check the design's validation report.`,
    build.giftWrap &&
      "Gift order: the card message isn't part of the order. Confirm the card message with the customer by email now, so the card is ready at packing.",
    phantomDate &&
      `Phantom date: the ${parts.movement?.caliber} has a date wheel but the ${parts.dial?.name} dial has no window, so the crown's first position turns a hidden ${hiddenDay ? "date and day" : "date"} and nothing visible happens. Tell the customer this is normal.`,
    hiddenDay &&
      !phantomDate &&
      `The ${parts.movement?.caliber}'s day wheel is hidden by this dial: turning the crown clockwise in its first position changes a day nobody can see. Tell the customer this is normal.`,
    ...dataNotes,
  ]);
}

function summaryFor({ parts, spare }: Build, extras: ResolvedExtras, benchMinutes: number): string {
  const { movement, case: watchCase, dial, hands } = parts;
  const heart = movement && watchCase ? `${movement.name} in the ${watchCase.name}` : "An NH3x build";
  const face = dial && hands ? ` with the ${dial.name} dial and ${hands.name} hands` : "";
  const ordered = [...(spare ? [`a spare ${strapNoun(spare)}`] : []), ...extras.items.map((extra) => lowerFirst(extra.name))];
  const withExtras = ordered.length > 0 ? ` Extras: ${listJoin(ordered)}.` : "";
  return `${heart}${face}. About ${formatMinutes(benchMinutes)} at the bench, plus regulation, a pressure test and a 24-hour run-in.${withExtras}`;
}

/** Step-by-step assembly instructions, BOM, tools and QC checks for the watchmaker. Pure. */
export function createBuildSheet(spec: WatchSpec, catalog: Catalog = CATALOG): BuildSheet {
  const parts = resolveSpec(spec, catalog);
  const extras = resolveExtras(spec, catalog);
  const build = describeBuild(spec, parts, extras);
  const slots = partsBySlot(spec, catalog);
  const estimatedBenchMinutes = estimateBenchMinutes(parts, spec.personalization, extras);
  return {
    title: `Build sheet: ${spec.name.trim() || "Untitled design"}`,
    summary: summaryFor(build, extras, estimatedBenchMinutes),
    bom: billOfMaterials(slots, spec.personalization, movementVariant(build), extras),
    tools: toolsFor(build),
    steps: present(STEPS.map((step) => step(build))),
    qcChecks: qcChecks(build),
    notes: notesFor(build, slots, unknownExtras(spec, extras)),
    estimatedBenchMinutes,
  };
}
