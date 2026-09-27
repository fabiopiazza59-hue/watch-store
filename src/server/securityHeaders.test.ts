import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("security headers (next.config.ts)", () => {
  it("sends a same-origin CSP that forbids framing, plus the usual hardening headers, on every path", async () => {
    const [rule] = (await nextConfig.headers?.()) ?? [];
    expect(rule.source).toBe("/:path*");
    const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(headers).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
