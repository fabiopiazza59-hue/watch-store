"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Customer pages only. The workshop (/orders) is bookmarked by the workshop, not shown to customers.
const LINKS = [
  { href: "/", label: "Design" },
  { href: "/how-it-works", label: "How it works" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-block rounded-full px-3 py-2.5 transition-colors sm:py-1.5 ${
                active ? "bg-ink text-paper" : "text-ink-soft hover:bg-surface-muted hover:text-ink"
              }`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
