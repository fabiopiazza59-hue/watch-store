// Assembly instructions for the watchmaker, generated from the actual parts of a spec.
//
// Procedures follow Seiko's NH3x/4R3x instructions and common modding practice. Where practice varies
// between case makers the text says so rather than guessing.
import { CATALOG, resolveSpec, SLOTS } from "./catalog";
import type {
  BomLine,
  BuildSheet,
  BuildStep,
  Catalog,
  CrownPosition,
  Movement,
  Part,
  Personalization,
  QcCheck,
  ResolvedSpec,
  SlotDef,
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
} as const;

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

/** Bench minutes for one watch. Pure; unknown/missing parts simply add nothing. */
export function estimateBenchMinutes(parts: ResolvedSpec, personalization: Personalization): number {
  return (
    BENCH_MINUTES.base +
    (parts.movement?.complications.includes("gmt") ? BENCH_MINUTES.gmtHand : 0) +
    (parts.bezelInsert ? BENCH_MINUTES.bezelInsert : 0) +
    requestedPersonalization(personalization).length * BENCH_MINUTES.perPersonalization +
    (parts.strap?.type === "bracelet" ? BENCH_MINUTES.braceletSizing : 0)
  );
}

/** Timegrapher lift angle for the NH3x family (one source gives 54° for the NH34). */
const LIFT_ANGLE_DEG = 53;

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
}

function describeBuild(spec: WatchSpec, parts: ResolvedSpec): Build {
  const { movement, dial } = parts;
  const aperture = dial?.dateWindow ?? "none";
  const hasDay = movement?.complications.includes("day") ?? false;
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

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Seiko's "do not quick-set" window for each NH3x variant, from the calibre instructions. */
function quicksetBlackout(movement: Movement): string | null {
  if (!movement.hasDateWheel) return null;
  if (movement.complications.includes("day")) return "9 p.m. and 4 a.m.";
  if (movement.complications.includes("gmt")) return "9 p.m. and 3 a.m.";
  return "9 p.m. and 1 a.m.";
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

const checkPartsIn: StepBuilder = ({ parts, showsDate }) => {
  const { case: watchCase, dial, crystal, hands } = parts;
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
      showsDate && "Check the movement's date disc colour suits the dial.",
    ),
    cautions: present([
      withNotes && "Some values in the notes below are estimates or single-source: measure those parts now and correct the catalogue if they differ.",
      "If the crystal arrives already fitted in the case, leave it there; a well-seated crystal already proves the size.",
    ]),
  };
};

const testMovement: StepBuilder = ({ parts, displayBack }) => {
  const { movement } = parts;
  if (!movement) return null;
  return {
    title: `Test the ${movement.caliber} before assembly`,
    detail: `Wind the bare movement by the stem (about 20 turns gets it running) and put it on the timegrapher at ${movement.beatRateVph.toLocaleString("en-US")} vph, lift angle ${LIFT_ANGLE_DEG}°. Note rate, amplitude and beat error dial up. This baseline tells you later whether a fault came with the movement or from assembly.`,
    cautions: present([
      "Keep the movement in its holder and wear finger cots from here on.",
      displayBack && "This watch has a display caseback: a fingerprint on the rotor or bridges will be on show for good.",
      "If the rate jumps around or is far out, demagnetise the movement before suspecting a fault.",
    ]),
  };
};

const prepareCase: StepBuilder = ({ parts }) => {
  const { case: watchCase, crystal } = parts;
  if (!watchCase) return null;
  return {
    title: "Prepare the case",
    detail: sentences(
      `Clean the ${watchCase.name} inside and out with the blower and rodico.`,
      crystal &&
        `If the ${crystal.name} crystal isn't already fitted, press it into the crystal seat with its gasket, using the case press and flat nylon dies and pressing evenly.`,
    ),
    cautions: present([
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
      `The NH3x has no dial screws or clamps: the dial's two feet are a friction fit in the holes of the movement's dial spacer ring. The ${dial.name} dial is footed for a ${crown} crown; if it came with four feet, clip off the pair for the other crown position.`,
      "Line the feet up with their holes and press the dial down evenly at its edge until it sits flat.",
      isGmt && "The NH34 needs a GMT dial with an enlarged centre hole (about 2.7-2.9mm) to clear its 24h pinion: check it clears before you press.",
      showsDate && "Check the date sits centred in the window before going further.",
      showsDay && "Check the day sits level and centred too. A crooked day means the NH36 day-wheel variant doesn't match this case's crown position: sort it out now.",
      phantomDate && "This dial has no date window, so the movement's date disc is hidden underneath it.",
    ),
    cautions: [
      "Never press on a foot that isn't in its hole: it bends the foot or dents the dial.",
      "Dial dots (adhesive pads) are the fallback if the feet don't match, but then 12 o'clock has to be aligned by eye.",
      "Blow the dial clean before it goes on; dust caught under the crystal means taking everything apart again.",
    ],
  };
};

const fitHands: StepBuilder = ({ parts, isGmt }) => {
  const { hands, movement, case: watchCase } = parts;
  if (!hands) return null;
  const hasDateWheel = movement?.hasDateWheel ?? true;
  const gmtHole = movement?.handHolesMm.gmt ?? hands.holesMm.gmt;
  return {
    title: isGmt ? "Fit the four hands" : "Fit the hands",
    detail: sentences(
      "Lay the dial protector over the dial.",
      hasDateWheel
        ? "Pull the stem to the time-setting position (second click) and turn it slowly forwards until the date just snaps over to the next day: that is midnight. The hands go on at 12 in this position, so the date will change at midnight rather than at noon."
        : `The ${movement?.caliber ?? "movement"} has no date to time against, so fit the hands at 12 with the stem in the time-setting position.`,
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
        "Then pull the stem to the first position and turn it clockwise, as you would the crown: the 24h hand should jump one hour per step and land exactly on each marker.",
    ),
    cautions: present([
      "Fix any rubbing now. Once cased, the only way back is through the whole stack.",
      blackout && `Never use the calendar quick-set between ${blackout} (Seiko's instructions): it can stop the date changing or damage the mechanism.`,
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
      `With the caseback still off, wind fully and put the watch on the timegrapher (${movement.beatRateVph.toLocaleString("en-US")} vph, lift angle ${LIFT_ANGLE_DEG}°).`,
      "Check dial up, crown down and crown up at least; all six positions if you have time.",
      `The factory spec is ${formatAccuracy(movement)}, and careful regulation can usually get well inside that.`,
      "Healthy amplitude fully wound is about 250-310°, and beat error should be under 0.6 ms.",
      "Nudge the regulator lever towards + or - by half a division at a time and re-measure after each move.",
    ),
    cautions: present([
      "The NH3x regulator is very sensitive: move it a hair at a time.",
      "Low amplitude or an erratic trace is not a regulation problem. Look for a hand touching, dust or a damaged movement before going further.",
      "Beat error is set at the stud carrier, which is advanced work: leave it alone while you're learning.",
      isGmt && "Some sources give 54° as the NH34's lift angle. It changes the amplitude reading slightly, not the rate.",
    ]),
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
    detail: `Test before the strap goes on. The case is rated ${watchCase.waterResistanceM}m, which is ${bar} bar: dry-test it at ${bar} bar. If your tester stops short of that, test at its maximum and record the pressure you reached on the order.`,
    cautions: [
      screwDownCrown ? "Screw the crown fully down before testing." : "Push the crown fully in before testing.",
      "If it fails, check the usual suspects in turn: crown and crown gasket, caseback gasket, crystal gasket.",
    ],
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
        ? `Wind it and set the hands to 6 o'clock, well clear of the no-quick-set window (between ${blackout}). In the first crown position, ${quickset}. Then set the final time, making sure a.m. and p.m. are right: the date changes at midnight.`
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

const runIn: StepBuilder = () => ({
  title: "Run-in and final QC",
  detail: "Fully wind the watch and leave it running for 24 hours, then work through every QC check below and record the results on the order before it ships.",
  cautions: ["A watch that fails a check goes back to the step the problem came from. Note what you fixed on the order."],
});

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
  closeCaseback,
  fitBezelInsert,
  pressureTest,
  setAndFitStrap,
  runIn,
];

// ---------------------------------------------------------------------------
// QC checks, with acceptance criteria taken from the parts' own data.
// ---------------------------------------------------------------------------

function qcChecks(build: Build): QcCheck[] {
  const { parts, showsDate, showsDay, isGmt, displayBack, bracelet, screwDownCrown, dialText, engraving } = build;
  const { movement, case: watchCase, dial, hands } = parts;
  const rotatingBezel = watchCase?.bezel === "unidirectional-120" || watchCase?.bezel === "bidirectional-24h";
  const lumed = (dial && dial.lume !== "none") || (hands && hands.lume !== "none");

  return present<QcCheck>([
    movement && {
      id: "qc-rate",
      label: "Timekeeping",
      criterion: `${formatAccuracy(movement)} dial up, crown down and crown up, fully wound (lift angle ${LIFT_ANGLE_DEG}°); amplitude 250-310°, beat error under 0.6 ms.`,
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
      criterion: `No leak at ${watchCase.waterResistanceM / 10} bar (the case's ${watchCase.waterResistanceM}m rating). If your tester tops out lower, no leak at its maximum, with the pressure recorded on the order.`,
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
  ]);
}

// ---------------------------------------------------------------------------
// BOM, tools and notes
// ---------------------------------------------------------------------------

function billOfMaterials(slots: SlotPart[], personalization: Personalization): BomLine[] {
  const partLines = slots.flatMap(({ def, part }): BomLine[] =>
    part
      ? [{ slot: def.slot, partId: part.id, name: part.name, qty: 1, unitCostEur: part.costEur, supplierHint: part.supplierHint }]
      : [],
  );
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
  return [...partLines, ...serviceLines];
}

function toolsFor({ parts, isGmt, bracelet }: Build): string[] {
  const { movement, case: watchCase, bezelInsert } = parts;
  return present([
    "Movement holder for NH3x movements",
    isGmt
      ? "Hand press with flat nylon tips (a bench press with interchangeable tips is strongly recommended for the four-hand stack)"
      : "Hand press (hand-setting tool) with flat nylon tips",
    "Hand levers, for lifting a hand that goes on wrong",
    "Dial protector sheet",
    "Case press with nylon dies (crystal, press-fit casebacks)",
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
    watchCase ? `Pressure tester (the case is rated ${watchCase.waterResistanceM / 10} bar)` : "Pressure tester",
    "Spring-bar tool",
    bracelet && "Bracelet link tool (pin pusher or fine screwdrivers, to suit the link pins)",
    bezelInsert && "Isopropyl alcohol and lint-free swabs",
  ]);
}

function notesFor(build: Build, slots: SlotPart[]): string[] {
  const { parts, phantomDate, hiddenDay } = build;
  const missing = slots.filter(({ def, id, part }) => !part && !(def.optional && id === null));
  const dataNotes = slots.flatMap(({ part }) => (part?.dataNotes ? [`${part.name}: ${part.dataNotes}`] : []));
  return present([
    missing.length > 0 &&
      `Not buildable as specified: ${missing.map(({ def, id }) => (id ? `${def.label.toLowerCase()} '${id}' is not in the catalogue` : `no ${def.label.toLowerCase()} chosen`)).join("; ")}. Check the design's validation report.`,
    phantomDate &&
      `Phantom date: the ${parts.movement?.caliber} has a date wheel but the ${parts.dial?.name} dial has no window, so the crown's first position turns a hidden ${hiddenDay ? "date and day" : "date"} and nothing visible happens. Tell the customer this is normal.`,
    hiddenDay &&
      !phantomDate &&
      `The ${parts.movement?.caliber}'s day wheel is hidden by this dial: turning the crown clockwise in its first position changes a day nobody can see. Tell the customer this is normal.`,
    ...dataNotes,
  ]);
}

function summaryFor({ parts }: Build, benchMinutes: number): string {
  const { movement, case: watchCase, dial, hands } = parts;
  const heart = movement && watchCase ? `${movement.name} in the ${watchCase.name}` : "An NH3x build";
  const face = dial && hands ? ` with the ${dial.name} dial and ${hands.name} hands` : "";
  return `${heart}${face}. About ${formatMinutes(benchMinutes)} at the bench, plus regulation, a pressure test and a 24-hour run-in.`;
}

/** Step-by-step assembly instructions, BOM, tools and QC checks for the watchmaker. Pure. */
export function createBuildSheet(spec: WatchSpec, catalog: Catalog = CATALOG): BuildSheet {
  const parts = resolveSpec(spec, catalog);
  const build = describeBuild(spec, parts);
  const slots = partsBySlot(spec, catalog);
  const estimatedBenchMinutes = estimateBenchMinutes(parts, spec.personalization);
  return {
    title: `Build sheet: ${spec.name.trim() || "Untitled design"}`,
    summary: summaryFor(build, estimatedBenchMinutes),
    bom: billOfMaterials(slots, spec.personalization),
    tools: toolsFor(build),
    steps: present(STEPS.map((step) => step(build))),
    qcChecks: qcChecks(build),
    notes: notesFor(build, slots),
    estimatedBenchMinutes,
  };
}
