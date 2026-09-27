import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
/**
 * STATIC_EXPORT=1 builds the static demo for GitHub Pages (see scripts/build-pages.mjs): no server,
 * so no API routes, orders or response headers; the designer runs offline in the browser.
 */
const staticExport = process.env.STATIC_EXPORT === "1";
/** Set PUBLIC_ORIGIN (at build time) to the site's https:// address to also send the HTTPS-only headers. */
const servedOverHttps = process.env.PUBLIC_ORIGIN?.trim().startsWith("https://") ?? false;

/**
 * Everything the site loads comes from its own origin. Inline scripts and styles stay allowed
 * because Next's no-nonce setup needs them; React needs eval in development only.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(servedOverHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(servedOverHttps ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = staticExport
  ? {
      output: "export",
      basePath: process.env.PAGES_BASE_PATH ?? "",
      trailingSlash: true,
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_STATIC_DEMO: "1" },
    }
  : {
      poweredByHeader: false,
      async headers() {
        return [{ source: "/:path*", headers: securityHeaders }];
      },
    };

export default nextConfig;
