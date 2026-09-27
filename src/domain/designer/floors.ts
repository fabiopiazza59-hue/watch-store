// The least a buildable watch of a given kind costs the customer, so the offline designer can say
// "our dress watches start at about €X" when a budget is too tight, instead of guessing.
import { CATALOG, DEFAULT_SPEC, findPart, getSlotDef, NONE_OPTION_ID, partsForSlot } from "../catalog";
import { priceSpec } from "../pricing";
import { evaluateOptions, validateSpec } from "../rules";
import type { Catalog, Part, SlotKey, WatchSpec, WatchStyle } from "../types";
import { SELECTION_ORDER } from "./select";

/** The price a customer sees and pays, VAT included. */
export function customerPriceEur(spec: WatchSpec, catalog: Catalog = CATALOG): number {
  return priceSpec(spec, catalog).retailInclVatEur;
}

export interface FloorKind {
  /** A watch of this style: case and dial both. */
  style?: WatchStyle;
  /** A watch with a GMT movement. */
  gmt?: boolean;
}

export interface PriceFloor {
  spec: WatchSpec;
  priceEur: number;
}

/**
 * The search ranks designs by the sum of their part costs, which drives the price. The costs that
 * don't come from part prices but differ between designs (fitting a GMT hand, an insert or a
 * bracelet) are worth well under this many part euros, so no design this much dearer in parts
 * than the cheapest found can end up cheaper.
 */
const SEARCH_SLACK_EUR = 40;

const floors = new WeakMap<Catalog, Map<string, PriceFloor | null>>();

function allowed(kind: FloorKind, part: Part | undefined): boolean {
  if (!part) return true;
  if (kind.style && (part.category === "case" || part.category === "dial")) return part.style === kind.style;
  if (kind.gmt && part.category === "movement") return part.complications.includes("gmt");
  return true;
}

function withPart(spec: WatchSpec, slot: SlotKey, partId: string | null): WatchSpec {
  return slot === "bezelInsertId" ? { ...spec, bezelInsertId: partId } : { ...spec, [slot]: partId ?? "" };
}

/** Depth-first over SELECTION_ORDER, cheapest parts first, pruning branches that can't win. */
function cheapestBuild(kind: FloorKind, catalog: Catalog, allowWarnings: boolean): PriceFloor | null {
  const cheapestPart = SELECTION_ORDER.map((slot) =>
    Math.min(
      ...partsForSlot(slot, catalog)
        .filter((part) => allowed(kind, part))
        .map((part) => part.costEur),
      ...(getSlotDef(slot).optional ? [0] : []),
    ),
  );
  const stillToSpend = SELECTION_ORDER.map((_, depth) => cheapestPart.slice(depth).reduce((total, cost) => total + cost, 0));
  // Held in an object: TypeScript doesn't track assignments made inside the recursive closure.
  const found: { best?: { floor: PriceFloor; partsCost: number } } = {};

  const visit = (spec: WatchSpec, depth: number, decided: ReadonlySet<SlotKey>, partsCost: number): void => {
    const { best } = found;
    if (best && partsCost + (stillToSpend[depth] ?? 0) > best.partsCost + SEARCH_SLACK_EUR) return;
    if (depth === SELECTION_ORDER.length) {
      const report = validateSpec(spec, catalog);
      if (!report.buildable || (!allowWarnings && report.issues.some((issue) => issue.severity === "warning"))) return;
      const priceEur = customerPriceEur(spec, catalog);
      if (!best || priceEur < best.floor.priceEur) found.best = { floor: { spec, priceEur }, partsCost };
      return;
    }
    const slot = SELECTION_ORDER[depth];
    const options = evaluateOptions(slot, spec, catalog)
      .filter(({ issues }) => !issues.some((issue) => issue.severity === "error" && issue.slots.every((s) => s === slot || decided.has(s))))
      .map(({ partId }) => (partId === NONE_OPTION_ID ? null : partId))
      .map((partId) => ({ partId, part: findPart(partId, catalog) }))
      .filter(({ part }) => allowed(kind, part))
      .sort((a, b) => (a.part?.costEur ?? 0) - (b.part?.costEur ?? 0));
    const next = new Set([...decided, slot]);
    for (const { partId, part } of options) visit(withPart(spec, slot, partId), depth + 1, next, partsCost + (part?.costEur ?? 0));
  };

  visit({ ...DEFAULT_SPEC, name: "", personalization: { dialText: "", casebackEngraving: "" } }, 0, new Set(), 0);
  return found.best?.floor ?? null;
}

/**
 * The cheapest buildable design of a kind, preferring one without warnings; null when the parts
 * library can't build that kind at all. Worked out once per catalogue and kind, then remembered.
 */
export function priceFloor(kind: FloorKind = {}, catalog: Catalog = CATALOG): PriceFloor | null {
  let byKind = floors.get(catalog);
  if (!byKind) floors.set(catalog, (byKind = new Map()));
  const key = `${kind.style ?? "any"}:${kind.gmt ? "gmt" : "any"}`;
  if (!byKind.has(key)) byKind.set(key, cheapestBuild(kind, catalog, false) ?? cheapestBuild(kind, catalog, true));
  return byKind.get(key) ?? null;
}
