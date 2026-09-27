import { DEFAULT_SPEC, type DesignTemplate, specExtras, TEMPLATES } from "@/domain/catalog";
import type { WatchSpec } from "@/domain/types";
import { hasExtras } from "./extrasOptions";

/** True for a name the customer gave the design, rather than the default's or a template's. */
function isOwnName(name: string): boolean {
  return name.trim() !== "" && name !== DEFAULT_SPEC.name && !TEMPLATES.some((template) => template.spec.name === name);
}

/**
 * The template's parts, with the customer's own design name, dial text, engraving and extras kept.
 * The rules engine flags anything the new parts can't take (a dial that can't be printed, a glass
 * caseback, a spare strap for other lugs), each with a fix.
 */
export function applyTemplate(spec: WatchSpec, template: DesignTemplate): WatchSpec {
  const next: WatchSpec = {
    ...template.spec,
    name: isOwnName(spec.name) ? spec.name : template.spec.name,
    personalization: spec.personalization,
    extras: spec.extras,
  };
  // Extras are the customer's choice: none chosen means none, whatever the template carries.
  if (!next.extras) delete next.extras;
  return next;
}

/** "Started from Slate Pilot, keeping your name and dial text." */
export function templateLabel(spec: WatchSpec, template: DesignTemplate): string {
  const kept = [
    isOwnName(spec.name) && "name",
    spec.personalization.dialText.trim() && "dial text",
    spec.personalization.casebackEngraving.trim() && "engraving",
    hasExtras(specExtras(spec)) && "extras",
  ].filter((item): item is string => Boolean(item));
  if (kept.length === 0) return `Started from ${template.name}.`;
  const list = kept.length === 1 ? kept[0] : `${kept.slice(0, -1).join(", ")} and ${kept.at(-1)}`;
  return `Started from ${template.name}, keeping your ${list}.`;
}
