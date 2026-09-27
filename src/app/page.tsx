import { Configurator } from "@/components/configurator/Configurator";
import { decodeSpec, SHARE_PARAM } from "@/components/configurator/specCodec";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The configurator. A shared link (`/?d=…`) is decoded here so it renders right on first paint. */
export default async function Home({ searchParams }: HomeProps) {
  const shared = (await searchParams)[SHARE_PARAM];
  const sharedSpec = typeof shared === "string" ? decodeSpec(shared) : null;
  return <Configurator sharedSpec={sharedSpec} />;
}
