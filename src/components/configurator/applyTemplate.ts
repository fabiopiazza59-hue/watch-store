import { DEFAULT_SPEC, type DesignTemplate, TEMPLATES } from "@/domain/catalog";
import type { WatchSpec } from "@/domain/types";

/** True for a name the customer gave the design, rather than the default's or a template's. */
function isOwnName(name: string): boolean {
  return name.trim() !== "" && name !== DEFAULT_SPEC.name && !TEMPLATES.some((template) => template.spec.name === name);
}

/**
 * The template's parts, with the customer's own design name, dial text and engraving kept. The rules
 * engine flags any text the new parts can't take (a dial that can't be printed, a glass caseback).
 */
export function applyTemplate(spec: WatchSpec, template: DesignTemplate): WatchSpec {
  return {
    ...template.spec,
    name: isOwnName(spec.name) ? spec.name : template.spec.name,
    personalization: spec.personalization,
  };
}

/** "Started from Slate Pilot, keeping your name and dial text." */
export function templateLabel(spec: WatchSpec, template: DesignTemplate): string {
  const kept = [
    isOwnName(spec.name) && "name",
    spec.personalization.dialText.trim() && "dial text",
    spec.personalization.casebackEngraving.trim() && "engraving",
  ].filter((item): item is string => Boolean(item));
  if (kept.length === 0) return `Started from ${template.name}.`;
  const list = kept.length === 1 ? kept[0] : `${kept.slice(0, -1).join(", ")} and ${kept.at(-1)}`;
  return `Started from ${template.name}, keeping your ${list}.`;
}
