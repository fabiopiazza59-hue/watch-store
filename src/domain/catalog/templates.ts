import type { WatchSpec } from "../types";

export interface DesignTemplate {
  id: string;
  name: string;
  /** One-line pitch shown on the "start from" picker. */
  description: string;
  spec: WatchSpec;
}

// SEED DATA — expanded by the catalogue build step. Every template MUST validate as buildable.
export const TEMPLATES: DesignTemplate[] = [
  {
    id: "tpl-classic-diver",
    name: "Classic Diver",
    description: "42mm, 200m, black dial, 120-click bezel. The quintessential first build.",
    spec: {
      name: "Classic Diver",
      movementId: "mv-nh35a",
      caseId: "case-diver-42",
      dialId: "dial-diver-black",
      handsId: "hands-mercedes-silver",
      crystalId: "crystal-sapphire-flat-315",
      bezelInsertId: "insert-dive-black-alu",
      strapId: "strap-rubber-black-22",
      personalization: { dialText: "", casebackEngraving: "" },
    },
  },
];
