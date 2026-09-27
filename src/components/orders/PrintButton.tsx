"use client";

import { PrinterIcon } from "../ui/icons";
import { buttonClass } from "../ui/styles";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonClass("secondary", "md")} print:hidden`}>
      <PrinterIcon />
      Print build sheet
    </button>
  );
}
