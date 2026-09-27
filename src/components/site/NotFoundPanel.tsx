import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, cardClass, eyebrowClass } from "../ui/styles";

interface NotFoundPanelProps {
  title: string;
  children: ReactNode;
  /** A second way out, besides going back to the configurator. */
  secondary?: { href: string; label: string };
}

/** The site's "nothing here" page body, shared by the root and order 404s. */
export function NotFoundPanel({ title, children, secondary }: NotFoundPanelProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-16 sm:px-6 lg:pt-20">
      <div className={`${cardClass} flex flex-col items-center px-6 py-14 text-center`}>
        <p className={eyebrowClass}>404</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        <div className="mt-3 max-w-md leading-relaxed text-ink-soft">{children}</div>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonClass("primary", "md")}>
            Design a watch
          </Link>
          {secondary && (
            <Link href={secondary.href} className={buttonClass("secondary", "md")}>
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
