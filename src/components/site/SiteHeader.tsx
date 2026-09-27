import Link from "next/link";
import { STATIC_DEMO } from "./deployment";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper print:hidden">
      {STATIC_DEMO && (
        <p className="bg-ink px-4 py-2 text-center text-xs leading-relaxed text-paper sm:px-6">
          You&rsquo;re viewing a demo. Every design is checked and priced for real, but ordering is switched off and the
          designer runs in quick mode.
        </p>
      )}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-3 rounded-md">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">Atelier</span>
          <span className="hidden text-sm text-ink-faint italic sm:inline">Design it. We&rsquo;ll build it by hand.</span>
        </Link>
        <nav aria-label="Main">
          <NavLinks />
        </nav>
      </div>
    </header>
  );
}
