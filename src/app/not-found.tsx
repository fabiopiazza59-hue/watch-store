import type { Metadata } from "next";
import { NotFoundPanel } from "@/components/site/NotFoundPanel";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <NotFoundPanel title="This page isn't on the bench" secondary={{ href: "/how-it-works", label: "How it works" }}>
      <p>The link may be mistyped, or the page may have moved. Everything starts from the configurator.</p>
    </NotFoundPanel>
  );
}
