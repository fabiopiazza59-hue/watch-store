// CONTRACT STUB — implemented by the pricing/build-sheet build step. Keep this signature.
import type { Catalog, PriceQuote, WatchSpec } from "./types";
import { CATALOG } from "./catalog";

/** Cost breakdown, suggested retail price and lead time for one unit. Pure. */
export function priceSpec(spec: WatchSpec, catalog: Catalog = CATALOG): PriceQuote {
  void spec; void catalog;
  throw new Error("priceSpec: not implemented");
}
