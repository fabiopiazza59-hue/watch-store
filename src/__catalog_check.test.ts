// THROWAWAY QA check (delete after use): validates every template and renders a gallery.
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WatchPreview } from "@/components/preview/WatchPreview";
import { CATALOG, TEMPLATES, resolveSpec } from "@/domain/catalog";
import { priceSpec } from "@/domain/pricing";
import { validateSpec } from "@/domain/rules";
import type { WatchSpec } from "@/domain/types";

const OUT = "/tmp/claude-0/-home-user-watch-store/3167c217-b54d-5ffa-9a29-6cc6dc6a6daa/scratchpad/catalog-qa";
const NEW_TEMPLATES = new Set([
  "tpl-salmon-dress",
  "tpl-stone-field-36",
  "tpl-orange-tool-diver",
  "tpl-green-gmt",
  "tpl-burgundy-evening",
  "tpl-navy-pilot",
  "tpl-cream-field-day-date",
  "tpl-skin-diver",
]);

// One React tree for the whole gallery, so useId gives every preview its own SVG ids.
function card(title: string, subtitle: string, spec: WatchSpec, note = "") {
  return createElement(
    "figure",
    { key: title },
    createElement(WatchPreview, { parts: resolveSpec(spec), personalization: spec.personalization, size: 300 }),
    createElement("figcaption", null, createElement("b", null, title), createElement("br"), subtitle, note ? ` [${note}]` : ""),
  );
}

it("validates and renders every template", () => {
  const lines: string[] = [];
  const cards: ReturnType<typeof card>[] = [];
  for (const t of TEMPLATES) {
    const report = validateSpec(t.spec);
    const issues = report.issues.map((i) => `${i.severity}:${i.ruleId}: ${i.message}`);
    let price = "";
    try {
      const q = priceSpec(t.spec);
      price = `EUR ${q.retailInclVatEur} incl. VAT, ${q.leadTimeDays} days`;
    } catch (error) {
      price = `pricing threw: ${(error as Error).message}`;
    }
    lines.push(`${t.id} buildable=${report.buildable} ${price}\n  ${issues.join("\n  ") || "(no issues)"}`);
    if (NEW_TEMPLATES.has(t.id)) {
      cards.push(card(t.name, t.description, t.spec, issues.join(" | ")));
    }
  }
  // New parts not in a template, shown in a fitting case.
  const base = TEMPLATES.find((t) => t.id === "tpl-classic-diver")!.spec;
  const extra: [string, Partial<WatchSpec>][] = [
    ["Green day-date in Classic Diver 42, green ceramic, orange rubber", { movementId: "mv-nh36a", dialId: "dial-diver-green-daydate", bezelInsertId: "insert-dive-green-ceramic", strapId: "strap-rubber-orange-22" }],
    ["Blue dress dial in Dress 36, polished dauphine, basket 20? no: grey suede", { movementId: "mv-nh35a", caseId: "case-dress-36", dialId: "dial-dress-blue", handsId: "hands-dauphine-polished", crystalId: "crystal-sapphire-dd-295", bezelInsertId: null, strapId: "strap-suede-grey-20" }],
    ["Field Olive Wide in Titanium Field 39, large batons, green leather", { caseId: "case-field-ti-39", movementId: "mv-nh38a", dialId: "dial-field-olive-wide", handsId: "hands-baton-silver-large", crystalId: "crystal-sapphire-flat-345", bezelInsertId: null, strapId: "strap-leather-green-20" }],
    ["Black diver in Steel Diver 40? (Gilt) with basket rubber 20", { caseId: "case-diver-40", movementId: "mv-nh38a", dialId: "dial-diver-gilt", handsId: "hands-snowflake-gilt", crystalId: "crystal-sapphire-flat-305", bezelInsertId: "insert-dive-green-ceramic", strapId: "strap-rubber-orange-20" }],
    ["Black PVD 42 on basket rubber 22", { caseId: "case-sport-pvd-42", movementId: "mv-nh36a", dialId: "dial-sport-graphite-daydate", handsId: "hands-baton-black", bezelInsertId: null, strapId: "strap-rubber-basket-black-22" }],
  ];
  for (const [label, patch] of extra) {
    const spec = { ...base, ...patch };
    const report = validateSpec(spec);
    const issues = report.issues.filter((i) => i.severity !== "info").map((i) => `${i.severity}:${i.ruleId}`);
    lines.push(`EXTRA ${label} buildable=${report.buildable} ${issues.join(", ")}`);
    cards.push(card(label, "", spec, issues.join(" | ")));
  }
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{font:13px system-ui;background:#f3f1ec;margin:16px;display:grid;grid-template-columns:repeat(4,310px);gap:12px}
    figure{margin:0;background:#fff;border-radius:8px;padding:6px}
    figcaption{padding:4px;line-height:1.3}</style>${renderToStaticMarkup(createElement("main", { style: { display: "contents" } }, ...cards))}`;
  writeFileSync(`${OUT}/gallery.html`, html);
  writeFileSync(`${OUT}/report.txt`, lines.join("\n"));
  console.log(lines.join("\n"));
  console.log(`cases=${CATALOG.cases.length} dials=${CATALOG.dials.length} hands=${CATALOG.hands.length} crystals=${CATALOG.crystals.length} inserts=${CATALOG.bezelInserts.length} straps=${CATALOG.straps.length} templates=${TEMPLATES.length}`);
  expect(TEMPLATES.every((t) => validateSpec(t.spec).buildable)).toBe(true);
});
