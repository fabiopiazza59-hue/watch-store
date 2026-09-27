import { resolveSpec, SLOTS } from "@/domain/catalog";
import type { Order, ResolvedSpec, SlotKey } from "@/domain/types";

export interface CatalogueChange {
  /** The slot's label, e.g. "Dial". */
  label: string;
  /** The part's name when the order was placed. */
  ordered: string;
  /** Its name in today's catalogue, or null when it is no longer listed. */
  now: string | null;
}

export interface OrderParts {
  /** The parts to draw and list: the order's own copy when it has one, else today's catalogue. */
  parts: ResolvedSpec;
  /** Names as ordered (from the build sheet), for parts today's catalogue no longer lists. */
  orderedNames: Partial<Record<SlotKey, string>>;
  /** Parts whose catalogue entry has changed or gone since the order was placed. */
  changes: CatalogueChange[];
}

/** The build sheet names the movement with the variant to order: "NH35A automatic, with a white date wheel". */
function sameName(ordered: string, now: string): boolean {
  return ordered === now || ordered.startsWith(`${now}, `);
}

/** Same data, whatever order the keys were written in (an order file's copy is read back re-ordered). */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const keys = Object.keys(aRecord).filter((key) => aRecord[key] !== undefined);
  const otherKeys = Object.keys(bRecord).filter((key) => bRecord[key] !== undefined);
  return keys.length === otherKeys.length && keys.every((key) => sameData(aRecord[key], bRecord[key]));
}

/**
 * An order's parts as they were ordered. The spec holds only part ids, so without a copy stored in
 * the order, a catalogue edited since would show new names and sizes beside the build sheet's.
 */
export function orderParts(order: Order): OrderParts {
  const live = resolveSpec(order.spec);
  const snapshot = order.parts;
  const orderedNames: Partial<Record<SlotKey, string>> = {};
  const changes: CatalogueChange[] = [];

  for (const def of SLOTS) {
    if (!order.spec[def.slot]) continue;
    const now = live[def.category];
    const copied = snapshot?.[def.category];
    const bomName = order.buildSheet.bom.find((line) => line.slot === def.slot)?.name;
    const ordered = copied?.name ?? bomName;
    if (ordered) orderedNames[def.slot] = ordered;
    if (!ordered) continue;
    const changed = copied ? !sameData(copied, now) : !now || !sameName(ordered, now.name);
    if (changed) changes.push({ label: def.label, ordered, now: now?.name ?? null });
  }
  return { parts: snapshot ?? live, orderedNames, changes };
}
