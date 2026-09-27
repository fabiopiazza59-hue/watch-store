import { CATALOG, getSlotDef } from "@/domain/catalog";
import type { BomLine, BuildSheet } from "@/domain/types";
import { formatCost, formatDuration } from "../ui/format";
import { WrenchIcon } from "../ui/icons";
import { cardClass, eyebrowClass } from "../ui/styles";
import { AssemblySteps } from "./AssemblySteps";
import { Checklist } from "./Checklist";

/**
 * "Dial", "Personalization", "Spare strap" or "Extra". A spare strap is told from the other extras by
 * the order's spare strap id when it is given, else by being a strap in the catalogue.
 */
export function bomSlotLabel(line: BomLine, spareStrapId?: string | null): string {
  if (line.slot === "personalization") return "Personalization";
  if (line.slot === "extra") {
    const spare =
      spareStrapId === undefined
        ? CATALOG.straps.some((strap) => strap.id === line.partId)
        : line.partId !== null && line.partId === spareStrapId;
    return spare ? "Spare strap" : "Extra";
  }
  return getSlotDef(line.slot).label;
}

function bomKey(line: BomLine, index: number): string {
  return `${line.slot}-${line.partId ?? index}`;
}

const sectionTitleClass = "font-display text-xl font-semibold text-ink";

interface BuildSheetViewProps {
  sheet: BuildSheet;
  /** Keeps this order's ticks apart from other orders' in the browser. */
  orderId: string;
  /** The order's spare strap, so its line reads "Spare strap" rather than "Extra". */
  spareStrapId?: string | null;
  /**
   * "workshop" (default): everything, including unit costs, the materials total and where to source
   * each part. "public": the parts and the work only, for pages anyone can see (the static demo).
   */
  audience?: "workshop" | "public";
}

/** The watchmaker's instructions for one order, laid out to work on screen and on paper. */
export function BuildSheetView({ sheet, orderId, spareStrapId, audience = "workshop" }: BuildSheetViewProps) {
  const internal = audience === "workshop";
  const bomTotal = sheet.bom.reduce((total, line) => total + line.qty * line.unitCostEur, 0);

  return (
    <section aria-labelledby="build-sheet-title" className={`${cardClass} p-5 sm:p-8 print:border-0 print:p-0`}>
      <header className="border-b border-line pb-5">
        <p className={eyebrowClass}>Build sheet</p>
        <h2 id="build-sheet-title" className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          {sheet.title}
        </h2>
        <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">{sheet.summary}</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-sm text-ink-soft">
          <WrenchIcon />
          About {formatDuration(sheet.estimatedBenchMinutes)} at the bench
        </p>
      </header>

      <div className="mt-6">
        <h3 className={sectionTitleClass}>Bill of materials</h3>

        {/* Phones get one card per line; the table needs more width than they have. */}
        <ul className="mt-3 divide-y divide-line sm:hidden print:hidden">
          {sheet.bom.map((line, index) => (
            <li key={bomKey(line, index)} className="py-3">
              <p className="text-xs font-medium tracking-[0.08em] text-ink-faint uppercase">{bomSlotLabel(line, spareStrapId)}</p>
              <p className="mt-0.5 font-medium text-ink">{line.name}</p>
              {line.partId && <p className="font-mono text-xs break-all text-ink-faint">{line.partId}</p>}
              {internal && <p className="mt-1 text-xs leading-relaxed text-ink-soft">{line.supplierHint}</p>}
              <p className="mt-1 text-right text-sm text-ink tabular-nums">
                {internal
                  ? `${line.qty} × ${formatCost(line.unitCostEur)} = ${formatCost(line.qty * line.unitCostEur)}`
                  : `Qty ${line.qty}`}
              </p>
            </li>
          ))}
          {internal && (
            <li className="flex justify-between py-3 font-medium text-ink">
              <span>Materials total</span>
              <span className="font-semibold tabular-nums">{formatCost(bomTotal)}</span>
            </li>
          )}
        </ul>

        <div className="mt-3 hidden overflow-x-auto sm:block print:block">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line-strong text-left text-xs tracking-[0.08em] text-ink-faint uppercase">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Slot
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {internal ? "Part and sourcing" : "Part"}
                </th>
                <th scope="col" className={`py-2 text-right font-medium ${internal ? "pr-4" : ""}`}>
                  Qty
                </th>
                {internal && (
                  <>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">
                      Unit
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Total
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sheet.bom.map((line, index) => (
                <tr key={bomKey(line, index)} className="align-top">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-ink-soft">{bomSlotLabel(line, spareStrapId)}</td>
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-ink">{line.name}</span>
                    {line.partId && <span className="ml-2 font-mono text-xs text-ink-faint">{line.partId}</span>}
                    {internal && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{line.supplierHint}</span>
                    )}
                  </td>
                  <td className={`py-2.5 text-right tabular-nums ${internal ? "pr-4" : ""}`}>{line.qty}</td>
                  {internal && (
                    <>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{formatCost(line.unitCostEur)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatCost(line.qty * line.unitCostEur)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            {internal && (
              <tfoot>
                <tr className="border-t border-line-strong">
                  <th scope="row" colSpan={4} className="py-2.5 pr-4 text-right font-medium text-ink">
                    Materials total
                  </th>
                  <td className="py-2.5 text-right font-semibold text-ink tabular-nums">{formatCost(bomTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Right after the parts they are about, so estimated sizes are measured before assembly starts. */}
      {sheet.notes.length > 0 && (
        <div className="mt-8 break-inside-avoid">
          <h3 className={sectionTitleClass}>Notes on these parts</h3>
          <ul className="mt-2 flex max-w-prose list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
            {sheet.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h3 className={sectionTitleClass}>Tools</h3>
        <div className="mt-2">
          <Checklist
            label="Tools"
            columns
            orderId={orderId}
            list="tools"
            items={sheet.tools.map((tool, index) => ({ id: `tool-${index}`, label: tool }))}
          />
        </div>
      </div>

      <div className="mt-8">
        <h3 className={sectionTitleClass}>Assembly</h3>
        <AssemblySteps steps={sheet.steps} orderId={orderId} />
      </div>

      <div className="mt-8">
        <h3 className={`${sectionTitleClass} break-after-avoid`}>Quality control</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Every check must pass before the watch ships.
          <span className="hidden print:inline"> Write each reading on its line.</span>
        </p>
        <div className="mt-2">
          <Checklist
            label="Quality control checks"
            orderId={orderId}
            list="qc"
            printResultLine
            items={sheet.qcChecks.map((check) => ({ id: check.id, label: check.label, detail: check.criterion }))}
          />
        </div>
      </div>
    </section>
  );
}
