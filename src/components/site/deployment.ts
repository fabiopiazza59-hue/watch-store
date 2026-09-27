/**
 * How this build is deployed. The static GitHub Pages demo (STATIC_EXPORT=1, see next.config.ts)
 * has no server: no API routes, orders or Claude designer, and it lives under a base path.
 */
export const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";

/** The site's base path ("/watch-store" on GitHub Pages, "" otherwise), for URLs built by hand. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
