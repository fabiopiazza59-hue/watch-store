import { getSlotDef } from "@/domain/catalog";
import type { BomLine, BuildSheet } from "@/domain/types";
import { formatCost, formatDuration } from "../ui/format";
import { AlertIcon, WrenchIcon } from "../ui/icons";
import { cardClass, eyebrowClass } from "../ui/styles";
import { Checklist } from "./Checklist";

function bomSlotLabel(line: BomLine): string {
  return line.slot === "personalization" ? "Personalization" : getSlotDef(line.slot).label;
}

const sectionTitleClass = "font-display text-xl font-semibold text-ink";

/** The watchmaker's instructions for one order, laid out to work on screen and on paper. */
export function BuildSheetView({ sheet }: { sheet: BuildSheet }) {
  const bomTotal = sheet.bom.reduce((total, line) => total + line.qty * line.unitCostEur, 0);

  return (
    <section
      aria-labelledby="build-sheet-title"
      className={`${cardClass} p-5 sm:p-8 print:border-0 print:p-0`}
    >
      <header className="border-b border-line pb-5">
        <p className={eyebrowClass}>Build sheet</p>
        <h2 id="build-sheet-title" className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          {sheet.title}
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">{sheet.summary}</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-sm text-ink-soft">
          <WrenchIcon />
          About {formatDuration(sheet.estimatedBenchMinutes)} at the bench
        </p>
      </header>

      <div className="mt-6">
        <h3 className={sectionTitleClass}>Bill of materials</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line-strong text-left text-xs tracking-[0.08em] text-ink-faint uppercase">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Slot
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Part and sourcing
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Unit
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sheet.bom.map((line, index) => (
                <tr key={`${line.slot}-${line.partId ?? index}`} className="align-top">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-ink-soft">{bomSlotLabel(line)}</td>
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-ink">{line.name}</span>
                    {line.partId && <span className="ml-2 font-mono text-xs text-ink-faint">{line.partId}</span>}
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{line.supplierHint}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{line.qty}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{formatCost(line.unitCostEur)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatCost(line.qty * line.unitCostEur)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong">
                <th scope="row" colSpan={4} className="py-2.5 pr-4 text-right font-medium text-ink">
                  Materials total
                </th>
                <td className="py-2.5 text-right font-semibold text-ink tabular-nums">{formatCost(bomTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h3 className={sectionTitleClass}>Tools</h3>
        <div className="mt-2">
          <Checklist
            label="Tools"
            columns
            items={sheet.tools.map((tool, index) => ({ id: `tool-${index}`, label: tool }))}
          />
        </div>
      </div>

      <div className="mt-8">
        <h3 className={sectionTitleClass}>Assembly</h3>
        <ol className="mt-4 flex flex-col gap-5">
          {sheet.steps.map((step, index) => (
            <li key={index} className="flex break-inside-avoid gap-4">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-brass/60 font-display text-lg font-semibold text-brass-ink"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <h4 className="font-semibold text-ink">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </h4>
                <p className="mt-1 leading-relaxed text-ink-soft">{step.detail}</p>
                {step.cautions.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5 rounded-lg border border-warn/25 bg-warn-soft/60 p-3">
                    {step.cautions.map((caution, cautionIndex) => (
                      <li key={cautionIndex} className="flex gap-2 text-sm leading-relaxed text-ink">
                        <AlertIcon className="mt-0.5 size-4 shrink-0 text-warn" />
                        <span>
                          <span className="sr-only">Caution: </span>
                          {caution}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 break-inside-avoid">
        <h3 className={sectionTitleClass}>Quality control</h3>
        <p className="mt-1 text-sm text-ink-soft">Every check must pass before the watch ships.</p>
        <div className="mt-2">
          <Checklist
            label="Quality control checks"
            items={sheet.qcChecks.map((check) => ({ id: check.id, label: check.label, detail: check.criterion }))}
          />
        </div>
      </div>

      {sheet.notes.length > 0 && (
        <div className="mt-8 break-inside-avoid">
          <h3 className={sectionTitleClass}>Notes</h3>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
            {sheet.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
