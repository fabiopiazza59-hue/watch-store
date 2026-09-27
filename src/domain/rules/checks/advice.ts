import { lumeLabel, quote, styleLabel } from "../format";
import { finding, type Finding, type RuleContext } from "../model";

/** Water resistance from which a sapphire crystal is recommended. */
export const SAPPHIRE_RECOMMENDED_FROM_M = 200;

/** `lume-match`: dial and hands glow in the same colour. */
export function lumeMatch({ parts }: RuleContext): Finding[] {
  const { dial, hands } = parts;
  if (!dial || !hands || dial.lume === "none" || hands.lume === "none" || dial.lume === hands.lume) return [];
  return [
    finding({
      ruleId: "lume-match",
      severity: "info",
      message:
        `The ${quote(dial.name)} dial has ${lumeLabel(dial.lume)} lume and the ${quote(hands.name)} hands have ` +
        `${lumeLabel(hands.lume)} lume, so in the dark they'll glow in two different colours.`,
      slots: ["dialId", "handsId"],
    }),
  ];
}

/** `crystal-material`: dive-rated cases get sapphire. */
export function crystalMaterial({ parts }: RuleContext): Finding[] {
  const { case: watchCase, crystal } = parts;
  if (!watchCase || !crystal || crystal.material !== "mineral") return [];
  if (watchCase.waterResistanceM < SAPPHIRE_RECOMMENDED_FROM_M) return [];
  return [
    finding({
      ruleId: "crystal-material",
      severity: "info",
      message:
        `The ${quote(watchCase.name)} case is rated to ${watchCase.waterResistanceM} m, a real tool watch. ` +
        `We'd recommend a sapphire crystal: it's far more scratch-resistant than mineral glass.`,
      slots: ["crystalId", "caseId"],
    }),
  ];
}

/** `style-coherence`: dial and case share a style. Taste only. */
export function styleCoherence({ parts }: RuleContext): Finding[] {
  const { case: watchCase, dial } = parts;
  if (!watchCase || !dial || dial.style === watchCase.style) return [];
  return [
    finding({
      ruleId: "style-coherence",
      severity: "info",
      message:
        `A ${styleLabel(dial.style)} dial in a ${styleLabel(watchCase.style)} case is an unusual mix. ` +
        `It's perfectly buildable; just make sure it's the look you're after.`,
      slots: ["dialId", "caseId"],
    }),
  ];
}
