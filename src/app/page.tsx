import { Suspense } from "react";
import { Configurator } from "@/components/configurator/Configurator";
import { SharedLinkConfigurator } from "@/components/configurator/SharedLinkConfigurator";
import { decodeSpec, SHARE_PARAM } from "@/components/configurator/specCodec";
import { STATIC_DEMO } from "@/components/site/deployment";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The configurator. A shared link (`/?d=…`) is decoded here so it renders right on first paint;
 * the static demo has no server, so there the browser decodes it after the default design shows.
 */
export default async function Home({ searchParams }: HomeProps) {
  if (STATIC_DEMO) {
    return (
      <Suspense fallback={<Configurator sharedSpec={null} />}>
        <SharedLinkConfigurator />
      </Suspense>
    );
  }
  const shared = (await searchParams)[SHARE_PARAM];
  const sharedSpec = typeof shared === "string" ? decodeSpec(shared) : null;
  return <Configurator sharedSpec={sharedSpec} />;
}
