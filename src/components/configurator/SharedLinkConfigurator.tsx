"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Configurator } from "./Configurator";
import { decodeSpec, SHARE_PARAM } from "./specCodec";

/**
 * The configurator reading a shared link (`?d=…`) in the browser, for the static demo, where there
 * is no server to decode it before the first paint.
 */
export function SharedLinkConfigurator() {
  const shared = useSearchParams().get(SHARE_PARAM);
  const sharedSpec = useMemo(() => (shared ? decodeSpec(shared) : null), [shared]);
  return <Configurator sharedSpec={sharedSpec} />;
}
