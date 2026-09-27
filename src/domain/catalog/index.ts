import type {
  Catalog,
  Part,
  ResolvedSpec,
  SlotDef,
  SlotKey,
  WatchSpec,
} from "../types";
import { bezelInserts } from "./bezelInserts";
import { cases } from "./cases";
import { crystals } from "./crystals";
import { dials } from "./dials";
import { hands } from "./hands";
import { movements } from "./movements";
import { straps } from "./straps";

export { dateWheelColour, type DateWheelColour } from "./dateWheel";
export { TEMPLATES, type DesignTemplate } from "./templates";

/** The parts library: every part the workshop can source, with real dimensions. */
export const CATALOG: Catalog = {
  movements,
  cases,
  dials,
  hands,
  crystals,
  bezelInserts,
  straps,
};

/** Configurator slots in build order. */
export const SLOTS: SlotDef[] = [
  { slot: "caseId", catalogKey: "cases", category: "case", label: "Case", optional: false },
  { slot: "movementId", catalogKey: "movements", category: "movement", label: "Movement", optional: false },
  { slot: "dialId", catalogKey: "dials", category: "dial", label: "Dial", optional: false },
  { slot: "handsId", catalogKey: "hands", category: "hands", label: "Hands", optional: false },
  { slot: "bezelInsertId", catalogKey: "bezelInserts", category: "bezelInsert", label: "Bezel insert", optional: true },
  { slot: "crystalId", catalogKey: "crystals", category: "crystal", label: "Crystal", optional: false },
  { slot: "strapId", catalogKey: "straps", category: "strap", label: "Strap", optional: false },
];

/** Option id used by `evaluateOptions` / pickers to represent "no part" for optional slots. */
export const NONE_OPTION_ID = "none";

export const PERSONALIZATION_LIMITS = {
  dialTextMaxLength: 20,
  casebackEngravingMaxLength: 60,
} as const;

/** A known-good starting design. Must always validate as buildable. */
export const DEFAULT_SPEC: WatchSpec = {
  name: "My first watch",
  movementId: "mv-nh35a",
  caseId: "case-diver-42",
  dialId: "dial-diver-black",
  handsId: "hands-mercedes-silver",
  crystalId: "crystal-sapphire-flat-315",
  bezelInsertId: "insert-dive-black-alu",
  strapId: "strap-rubber-black-22",
  personalization: { dialText: "", casebackEngraving: "" },
};

export function getSlotDef(slot: SlotKey): SlotDef {
  const def = SLOTS.find((s) => s.slot === slot);
  if (!def) throw new Error(`Unknown slot: ${slot}`);
  return def;
}

/** All parts that can fill a slot (unfiltered by compatibility). */
export function partsForSlot(slot: SlotKey, catalog: Catalog = CATALOG): Part[] {
  return catalog[getSlotDef(slot).catalogKey] as Part[];
}

/** Find any part by id across all categories. */
export function findPart(id: string | null | undefined, catalog: Catalog = CATALOG): Part | undefined {
  if (!id) return undefined;
  for (const key of Object.keys(catalog) as (keyof Catalog)[]) {
    const hit = (catalog[key] as Part[]).find((p) => p.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Resolve a spec's ids into parts. Ids of the wrong category resolve to undefined. */
export function resolveSpec(spec: WatchSpec, catalog: Catalog = CATALOG): ResolvedSpec {
  const pick = <K extends keyof Catalog>(key: K, id: string | null) =>
    id ? (catalog[key] as Catalog[K]).find((p) => p.id === id) : undefined;
  return {
    movement: pick("movements", spec.movementId),
    case: pick("cases", spec.caseId),
    dial: pick("dials", spec.dialId),
    hands: pick("hands", spec.handsId),
    crystal: pick("crystals", spec.crystalId),
    bezelInsert: pick("bezelInserts", spec.bezelInsertId),
    strap: pick("straps", spec.strapId),
  } as ResolvedSpec;
}
