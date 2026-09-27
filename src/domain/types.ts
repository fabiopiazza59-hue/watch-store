/**
 * Core domain model for the watch configurator.
 *
 * Design principle: whether a watch can be built is decided by deterministic
 * rules over real part dimensions (see `rules/`), never by the AI. The AI
 * designer only proposes specs and explains trade-offs; the rules engine is
 * the source of truth.
 *
 * All lengths are millimetres, all money is EUR.
 */

export type Currency = "EUR";

/** Crown position on the case, in clock hours. 3.8 ≈ "4 o'clock" SKX-style. */
export type CrownPosition = 3 | 3.8 | 4;

/** Movement families share dial feet, hand holes and case compatibility. */
export type MovementFamily = "NH3x";

export type Complication = "date" | "day" | "gmt";

/** Where the dial's date aperture sits, if any. */
export type DateWindow = "none" | "date-3" | "day-date-3";

export type WatchStyle = "diver" | "field" | "dress" | "pilot" | "gmt" | "sport";

export type LumeColor = "none" | "green" | "blue" | "vintage";

/** Common fields every catalogue part carries. */
export interface PartBase {
  id: string;
  name: string;
  /** One-line description shown in the configurator. */
  description: string;
  /** Estimated unit purchase cost from a supplier, EUR, excl. VAT. */
  costEur: number;
  /** Typical supplier lead time in days. */
  leadTimeDays: number;
  /** Free-text supplier/sourcing hint for the watchmaker (no URLs required). */
  supplierHint: string;
  /** Optional caveats on data accuracy ("verify dial feet with supplier"). */
  dataNotes?: string;
}

export interface Movement extends PartBase {
  category: "movement";
  family: MovementFamily;
  caliber: string; // e.g. "NH35A"
  maker: string;
  complications: Complication[];
  /** Which date apertures this movement can drive. */
  dateDisplay: DateWindow;
  /** True when the movement has a date wheel but it would be hidden by a no-date dial
   * (produces the "phantom date" crown position). */
  hasDateWheel: boolean;
  diameterMm: number;
  heightMm: number;
  jewels: number;
  beatRateVph: number;
  powerReserveHours: number;
  hacking: boolean;
  handWinding: boolean;
  /** Hand hole (pinion) diameters the hands must match. */
  handHolesMm: { hour: number; minute: number; seconds: number; gmt?: number };
  /** Manufacturer accuracy spec, seconds per day. */
  accuracySecPerDay: { min: number; max: number };
}

export type BezelType = "none" | "fixed" | "unidirectional-120" | "bidirectional-24h";

export interface WatchCase extends PartBase {
  category: "case";
  style: WatchStyle;
  material: "316L steel" | "titanium" | "bronze";
  finish: "brushed" | "polished" | "brushed & polished" | "bead-blasted" | "PVD black";
  movementFamily: MovementFamily;
  diameterMm: number;
  lugToLugMm: number;
  thicknessMm: number;
  lugWidthMm: number;
  crownPosition: CrownPosition;
  screwDownCrown: boolean;
  /** Dial diameter the case's dial seat accepts. */
  dialDiameterMm: number;
  /** Crystal diameter the case's crystal seat accepts. */
  crystalDiameterMm: number;
  bezel: BezelType;
  /** Bezel insert dimensions when the bezel takes an insert. */
  insertMm?: { outer: number; inner: number };
  /** Chapter ring (rehaut) present. */
  chapterRing: boolean;
  caseback: "solid" | "display";
  /**
   * The case maker's rating. When its figures disagree, the lowest; when it publishes none, a
   * conservative 50 m (both flagged with `waterResistanceEstimated`).
   */
  waterResistanceM: number;
  /**
   * True while the maker hasn't confirmed `waterResistanceM` in writing (no published figure, or
   * figures that disagree). Show the rating as unconfirmed and never pressure-test above it.
   */
  waterResistanceEstimated?: boolean;
  /** Clearance available above the dial for the hand stack, mm (approximation). */
  handClearanceMm: number;
  /**
   * Crystal shapes the case maker sells this case NH34-ready with: an NH34's taller hand stack, full-length
   * seconds hand included, clears them. Without an entry the case is treated as made for three-hand
   * movements, where a long seconds hand can brush the crystal (see the `hand-clearance` rule).
   */
  nh34ReadyCrystals?: Crystal["shape"][];
}

export interface Dial extends PartBase {
  category: "dial";
  style: WatchStyle;
  movementFamily: MovementFamily;
  diameterMm: number;
  /**
   * Diameter of the dial's centre hole, which must clear the movement's wheel pipes. Standard NH
   * dials are about 2.05 mm; NH34-ready GMT dials about 2.7-2.9 mm (the 24h wheel is wider).
   */
  centerHoleMm: number;
  /** The crown position this dial's feet/print orientation is designed for. */
  crownPosition: CrownPosition;
  dateWindow: DateWindow;
  /** Base colour as a CSS hex value, used by the preview renderer. */
  colorHex: string;
  /** Colour of printed indices/text as CSS hex. */
  printColorHex: string;
  texture: "matte" | "sunburst" | "grained" | "gloss";
  indices: "printed" | "applied" | "arabic" | "roman";
  lume: LumeColor;
  /** Includes a 24h scale ring printed on the dial (useful for GMT). */
  has24hScale: boolean;
  /** Dial can take a custom UV-printed text line (personalization). */
  printable: boolean;
}

export type HandStyle =
  | "sword"
  | "mercedes"
  | "dauphine"
  | "baton"
  | "snowflake"
  | "syringe"
  | "cathedral"
  | "arrow";

export interface HandSet extends PartBase {
  category: "hands";
  style: HandStyle;
  movementFamily: MovementFamily;
  holesMm: { hour: number; minute: number; seconds: number; gmt?: number };
  lengthsMm: { hour: number; minute: number; seconds: number; gmt?: number };
  includesGmt: boolean;
  colorHex: string;
  secondsColorHex: string;
  gmtColorHex?: string;
  lume: LumeColor;
}

export interface Crystal extends PartBase {
  category: "crystal";
  material: "sapphire" | "mineral";
  shape: "flat" | "domed" | "double-dome";
  diameterMm: number;
  thicknessMm: number;
  arCoating: "none" | "inner" | "both";
}

export interface BezelInsert extends PartBase {
  category: "bezelInsert";
  scale: "dive-60" | "gmt-24" | "countdown-60" | "plain";
  material: "aluminium" | "ceramic";
  outerMm: number;
  innerMm: number;
  colorHex: string;
  /** Second colour for two-tone (e.g. GMT) inserts. */
  secondaryColorHex?: string;
  printColorHex: string;
  lumePip: boolean;
}

export interface Strap extends PartBase {
  category: "strap";
  type: "leather" | "rubber" | "nato" | "bracelet" | "canvas";
  widthMm: number;
  colorHex: string;
  /** Bracelets with solid end links only fit specific cases. Empty/undefined = universal. */
  compatibleCaseIds?: string[];
}

export type Part =
  | Movement
  | WatchCase
  | Dial
  | HandSet
  | Crystal
  | BezelInsert
  | Strap;

export type PartCategory = Part["category"];

export interface Catalog {
  movements: Movement[];
  cases: WatchCase[];
  dials: Dial[];
  hands: HandSet[];
  crystals: Crystal[];
  bezelInserts: BezelInsert[];
  straps: Strap[];
}

/** Personalization applied per unit (possible in quantity 1). */
export interface Personalization {
  /** Short line UV-printed on the dial above 6 o'clock. Empty = none. Max 20 chars. */
  dialText: string;
  /** Laser engraving on a solid caseback. Empty = none. Max 60 chars. */
  casebackEngraving: string;
}

/**
 * Something that ships with the watch but isn't part of it: packaging, a tool, a gift touch, or a
 * bench service such as extra regulation. Listed in `catalog/extras.ts`.
 */
export interface Extra {
  id: string;
  name: string;
  /** One line for the customer: what it is and why they might want it. */
  description: string;
  kind: "packaging" | "tool" | "gift" | "service";
  /** Estimated unit cost to the workshop, EUR, excl. VAT (0 for pure bench services). */
  costEur: number;
  leadTimeDays: number;
  supplierHint: string;
  /** Extra bench time the workshop spends on it (regulation, wrapping). */
  benchMinutes: number;
}

/** What the customer adds to the order on top of the watch itself. */
export interface OrderExtras {
  /** A second strap in the box, from the strap catalogue. Must fit the case's lug width. Null = none. */
  spareStrapId: string | null;
  /** Ids from `EXTRAS`, each at most once, in catalogue order. */
  itemIds: string[];
}

/** Extras with ids resolved; unknown ids are dropped (the rules engine reports them). */
export interface ResolvedExtras {
  spareStrap?: Strap;
  items: Extra[];
}

/** A complete watch configuration. References parts by id. */
export interface WatchSpec {
  /** Optional nickname for the design ("Grandpa's field watch"). */
  name: string;
  movementId: string;
  caseId: string;
  dialId: string;
  handsId: string;
  crystalId: string;
  /** Null when the case has no insert bezel. */
  bezelInsertId: string | null;
  strapId: string;
  personalization: Personalization;
  /** Spare strap and add-ons. Absent = none (designs, links and orders from before extras existed). */
  extras?: OrderExtras;
}

/** Spec fields that hold part ids, in configurator order. */
export type SlotKey =
  | "movementId"
  | "caseId"
  | "dialId"
  | "handsId"
  | "crystalId"
  | "bezelInsertId"
  | "strapId";

export interface SlotDef {
  slot: SlotKey;
  catalogKey: keyof Catalog;
  category: PartCategory;
  label: string;
  optional: boolean;
}

/** Spec with ids resolved to parts. Missing/unknown ids resolve to undefined. */
export interface ResolvedSpec {
  movement?: Movement;
  case?: WatchCase;
  dial?: Dial;
  hands?: HandSet;
  crystal?: Crystal;
  bezelInsert?: BezelInsert;
  strap?: Strap;
}

// ---------------------------------------------------------------------------
// Rules engine
// ---------------------------------------------------------------------------

export type Severity = "error" | "warning" | "info";

export interface SuggestedFix {
  /** Human-readable description: "Switch to 20mm strap 'Olive NATO'". */
  description: string;
  /** Partial spec to merge to apply the fix. */
  patch: Partial<WatchSpec>;
}

export interface Issue {
  /** Stable rule identifier, e.g. "dial-crown-position". */
  ruleId: string;
  severity: Severity;
  /** Plain-language explanation aimed at a non-expert customer. */
  message: string;
  /** Slots involved, used by the UI to highlight pickers. */
  slots: SlotKey[];
  fixes: SuggestedFix[];
}

export interface ValidationReport {
  /** True when there are no `error` issues. */
  buildable: boolean;
  issues: Issue[];
}

/** Compatibility of a candidate part for a slot, given the rest of the spec. */
export interface OptionStatus {
  partId: string;
  /** True when choosing this part introduces no `error` issues involving this slot. */
  compatible: boolean;
  /** Errors/warnings that choosing this part would cause (involving this slot). */
  issues: Issue[];
}

export interface RepairResult {
  spec: WatchSpec;
  /** Human-readable list of the changes applied. */
  changes: string[];
  report: ValidationReport;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export interface PriceLine {
  label: string;
  kind: "part" | "personalization" | "extra" | "labour" | "qc" | "overhead";
  amountEur: number;
}

export interface PriceQuote {
  currency: Currency;
  lines: PriceLine[];
  partsCostEur: number;
  personalizationCostEur: number;
  /** Spare strap and add-ons (their bench time is in `labourCostEur`). */
  extrasCostEur: number;
  labourCostEur: number;
  overheadCostEur: number;
  totalCostEur: number;
  /** The workshop's price excluding VAT: `retailInclVatEur` less VAT. Margin is earned on this. */
  suggestedRetailEur: number;
  /** VAT rate included in `retailInclVatEur`, percent (0 for a VAT-exempt business). */
  vatRatePct: number;
  vatEur: number;
  /** The price a customer is shown and pays, VAT included, rounded to a price ending in 9. */
  retailInclVatEur: number;
  /** Gross margin on `suggestedRetailEur`, after every cost including the payment fee. */
  marginPct: number;
  /**
   * Set only on quotes read back from orders placed before VAT was itemised: their price was quoted
   * excluding VAT (VAT fields read as 0), so it is shown as "excl. VAT", not "no VAT charged".
   */
  quotedExclVat?: true;
  /** Days until shipment: slowest part lead time + bench time + QC. */
  leadTimeDays: number;
}

// ---------------------------------------------------------------------------
// Build sheet (instructions for the watchmaker assembling the order)
// ---------------------------------------------------------------------------

export interface BomLine {
  slot: SlotKey | "personalization" | "extra";
  partId: string | null;
  name: string;
  qty: number;
  unitCostEur: number;
  supplierHint: string;
}

export interface BuildStep {
  title: string;
  detail: string;
  /** Things that commonly go wrong at this step. */
  cautions: string[];
}

export interface QcCheck {
  id: string;
  label: string;
  /** Acceptance criterion, e.g. "-20 to +40 s/day in 6 positions". */
  criterion: string;
}

export interface BuildSheet {
  title: string;
  summary: string;
  bom: BomLine[];
  tools: string[];
  steps: BuildStep[];
  qcChecks: QcCheck[];
  notes: string[];
  estimatedBenchMinutes: number;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "received"
  | "parts-ordered"
  | "assembling"
  | "qc"
  | "shipped"
  | "cancelled";

export interface Customer {
  name: string;
  email: string;
}

export interface Order {
  id: string;
  createdAt: string; // ISO timestamp
  status: OrderStatus;
  customer: Customer;
  notes: string;
  spec: WatchSpec;
  /**
   * The parts as the catalogue described them when the order was placed, so the order still shows
   * what was ordered after the catalogue changes. Absent on orders placed before it was stored.
   */
  parts?: ResolvedSpec;
  /** The extras as the catalogue described them at order time, like `parts`. Absent when none were stored. */
  extras?: ResolvedExtras;
  quote: PriceQuote;
  buildSheet: BuildSheet;
}

// ---------------------------------------------------------------------------
// AI designer
// ---------------------------------------------------------------------------

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface DesignRequest {
  /** The customer's latest message ("a 38mm green field watch"). */
  message: string;
  /** The design currently shown in the configurator, if any. */
  currentSpec?: WatchSpec;
  /** Prior conversation turns (oldest first), excluding `message`. */
  history?: ChatTurn[];
}

export interface DesignResponse {
  /** "claude" when the Claude API produced the design, "offline" for the keyword fallback. */
  mode: "claude" | "offline";
  spec: WatchSpec;
  /** Conversational reply explaining the design and any trade-offs. */
  reply: string;
  report: ValidationReport;
  quote: PriceQuote;
  /** Summary of what changed relative to currentSpec. */
  changes: string[];
}
