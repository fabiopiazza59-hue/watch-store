import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BuildSheetPreview } from "@/components/orders/BuildSheetPreview";
import { STATIC_DEMO } from "@/components/site/deployment";

export const metadata: Metadata = { title: "Build sheet preview" };

/** The static demo's stand-in for placing an order. The full site takes real orders instead. */
export default function BuildSheetPreviewPage() {
  if (!STATIC_DEMO) notFound();
  return (
    <Suspense fallback={null}>
      <BuildSheetPreview />
    </Suspense>
  );
}
