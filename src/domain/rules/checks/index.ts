import type { Rule } from "../model";
import { crystalMaterial, lumeMatch, styleCoherence } from "./advice";
import { dateWindow, dialCenterHole, dialCrownPosition, dialSize } from "./dial";
import { extrasItems, spareStrap } from "./extras";
import { bezelInsert, bezelScale, crystalFit, strapWidth } from "./exterior";
import { gmtHand, handClearance, handFit, handLength } from "./hands";
import { missingParts, movementFamily } from "./parts";
import { casebackEngraving, dialText } from "./personalization";

/** Every rule, in the order of docs/feasibility-rules.md (which is also the report order within a severity). */
export const RULES: Rule[] = [
  missingParts,
  movementFamily,
  dialSize,
  dialCrownPosition,
  dateWindow,
  dialCenterHole,
  handFit,
  gmtHand,
  handLength,
  crystalFit,
  bezelInsert,
  bezelScale,
  strapWidth,
  handClearance,
  dialText,
  casebackEngraving,
  spareStrap,
  extrasItems,
  lumeMatch,
  crystalMaterial,
  styleCoherence,
];
