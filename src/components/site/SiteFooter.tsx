import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line print:hidden">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-8 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-display text-base text-ink-soft">Atelier</span> &middot; every watch assembled and
          regulated by hand around an NH3x-family automatic movement.
        </p>
        <p>
          <Link href="/how-it-works" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
            How we decide what can be built
          </Link>
        </p>
      </div>
    </footer>
  );
}
