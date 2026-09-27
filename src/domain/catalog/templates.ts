import type { WatchSpec } from "../types";

export interface DesignTemplate {
  id: string;
  name: string;
  /** One-line pitch shown on the "start from" picker. */
  description: string;
  spec: WatchSpec;
}

/** Curated starting designs. Every template MUST validate as buildable (see catalog.test.ts). */
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
  {
    id: "tpl-gilt-compact-diver",
    name: "Gilt Compact Diver",
    description: "39mm vintage diver on a bracelet: gilt print, domed sapphire and a true no-date movement.",
    spec: {
      name: "Gilt Compact Diver",
      movementId: "mv-nh38a",
      caseId: "case-diver-39",
      dialId: "dial-diver-gilt",
      handsId: "hands-snowflake-gilt",
      crystalId: "crystal-sapphire-domed-300",
      bezelInsertId: "insert-dive-gilt-365",
      strapId: "strap-bracelet-3link-20",
      personalization: { dialText: "", casebackEngraving: "" },
    },
  },
  {
    id: "tpl-everyday-field",
    name: "Everyday Field",
    description: "Slim 38mm field watch in olive and steel on waxed canvas. Wears with everything.",
    spec: {
      name: "Everyday Field",
      movementId: "mv-nh35a",
      caseId: "case-field-38",
      dialId: "dial-field-olive",
      handsId: "hands-sword-silver",
      crystalId: "crystal-sapphire-flat-295",
      bezelInsertId: null,
      strapId: "strap-canvas-khaki-20",
      personalization: { dialText: "", casebackEngraving: "" },
    },
  },
  {
    id: "tpl-roman-dress",
    name: "Roman Dress",
    description: "Polished 39mm with ivory Roman dial, dauphine hands and a caseback that shows the movement.",
    spec: {
      name: "Roman Dress",
      movementId: "mv-nh35a",
      caseId: "case-dress-39",
      dialId: "dial-dress-ivory-roman",
      handsId: "hands-dauphine-polished",
      crystalId: "crystal-sapphire-dd-295",
      bezelInsertId: null,
      strapId: "strap-leather-black-20",
      personalization: { dialText: "", casebackEngraving: "" },
    },
  },
  {
    id: "tpl-slate-pilot",
    name: "Slate Pilot",
    description: "39mm pilot with a wide 33.5mm dial, big numerals and syringe hands on tan leather.",
    spec: {
      name: "Slate Pilot",
      movementId: "mv-nh35a",
      caseId: "case-pilot-39",
      dialId: "dial-pilot-slate",
      handsId: "hands-syringe-white-large",
      crystalId: "crystal-sapphire-flat-345",
      bezelInsertId: null,
      strapId: "strap-leather-tan-20",
      personalization: { dialText: "", casebackEngraving: "" },
    },
  },
  {
    id: "tpl-travel-gmt",
    name: "Travel GMT",
    description: "NH34 GMT with a two-tone 24h bezel: track a second time zone at a glance.",
    spec: {
      name: "Travel GMT",
      movementId: "mv-nh34a",
      caseId: "case-gmt-40",
      dialId: "dial-gmt-black",
      handsId: "hands-gmt-mercedes-red",
      crystalId: "crystal-sapphire-flat-305",
      bezelInsertId: "insert-gmt-blue-red-alu",
      strapId: "strap-bracelet-5link-20",
      personalization: { dialText: "", casebackEngraving: "" },
    },
  },
  {
    id: "tpl-black-sport-day-date",
    name: "Black Sport Day-Date",
    description: "Black PVD 42mm with a graphite day-date dial and orange accents, on rubber.",
    spec: {
      name: "Black Sport Day-Date",
      movementId: "mv-nh36a",
      caseId: "case-sport-pvd-42",
      dialId: "dial-sport-graphite-daydate",
      handsId: "hands-baton-black",
      crystalId: "crystal-sapphire-flat-315",
      bezelInsertId: null,
      strapId: "strap-rubber-black-22",
      personalization: { dialText: "", casebackEngraving: "" },
    },
  },
  {
    id: "tpl-titanium-field",
    name: "Titanium Field",
    description: "Featherweight 39mm titanium with a wide sand dial and aged lume, on an olive NATO.",
    spec: {
      name: "Titanium Field",
      movementId: "mv-nh35a",
      caseId: "case-field-ti-39",
      dialId: "dial-field-sand",
      handsId: "hands-sword-black-large",
      crystalId: "crystal-sapphire-flat-345",
      bezelInsertId: null,
      strapId: "strap-nato-olive-20",
      personalization: { dialText: "", casebackEngraving: "" },
    },
  },
];
