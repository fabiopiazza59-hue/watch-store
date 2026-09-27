// CONTRACT STUB — implemented by the pricing/build-sheet build step. Keep this signature.
import type { BuildSheet, Catalog, WatchSpec } from "./types";
import { CATALOG } from "./catalog";

/** Step-by-step assembly instructions, BOM, tools and QC checks for the watchmaker. Pure. */
export function createBuildSheet(spec: WatchSpec, catalog: Catalog = CATALOG): BuildSheet {
  void spec; void catalog;
  throw new Error("createBuildSheet: not implemented");
}
