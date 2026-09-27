import { CATALOG } from "../catalog";
import { describeChanges } from "../rules";
import type { Catalog, WatchSpec } from "../types";

function nameLabel(name: string): string {
  return name.trim() ? `'${name}'` : "none";
}

/**
 * What changed between two designs, one line per field in configurator order, worded exactly like
 * the rules engine's automatic repairs: "Dial: Diver Black → Field Olive", "Dial text: none → 'For Anna'".
 */
export function describeSpecChanges(before: WatchSpec, after: WatchSpec, catalog: Catalog = CATALOG): string[] {
  const name = before.name !== after.name ? [`Name: ${nameLabel(before.name)} → ${nameLabel(after.name)}`] : [];
  return [...name, ...describeChanges(before, after, catalog)];
}
