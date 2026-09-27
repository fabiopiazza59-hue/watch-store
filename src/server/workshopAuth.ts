// Server-only: the optional workshop gate and customers' order confirmation links.
// With WORKSHOP_TOKEN unset, the workshop is open, as in local development. With it set, order
// lists, order pages and status changes need that token, sent as the `atelier_workshop` cookie (set
// by the workshop sign-in) or as `Authorization: Bearer <token>` (scripts).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const WORKSHOP_COOKIE = "atelier_workshop";
const WORKSHOP_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function configured(name: string): string | null {
  return process.env[name]?.trim() || null;
}

/** Compares secrets in constant time; hashing first gives both sides the same length. */
function sameSecret(candidate: string, secret: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(candidate), digest(secret));
}

export function workshopGateEnabled(): boolean {
  return configured("WORKSHOP_TOKEN") !== null;
}

/** True when `candidate` is the workshop token. Always false while the gate is off. */
export function isWorkshopToken(candidate: unknown): boolean {
  const token = configured("WORKSHOP_TOKEN");
  return token !== null && typeof candidate === "string" && sameSecret(candidate, token);
}

function cookieValue(cookieHeader: string | null, name: string): string | undefined {
  for (const pair of (cookieHeader ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * True when a request may use the workshop: the gate is off, or the request carries the token.
 * Takes plain headers, so route handlers (`request.headers`) and pages (`await headers()`) share it.
 */
export function isWorkshopRequest(headers: Headers): boolean {
  if (!workshopGateEnabled()) return true;
  const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return isWorkshopToken(bearer) || isWorkshopToken(cookieValue(headers.get("cookie"), WORKSHOP_COOKIE));
}

/** Options for the sign-in cookie, e.g. `(await cookies()).set(WORKSHOP_COOKIE, token, workshopCookieOptions())`. */
export function workshopCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: WORKSHOP_COOKIE_MAX_AGE_SECONDS,
  };
}

function orderLinkSecret(): string | null {
  return configured("ORDER_LINK_SECRET") ?? configured("WORKSHOP_TOKEN");
}

/**
 * The token in a customer's order confirmation link (`?t=`), so only whoever placed the order can
 * open its confirmation page. Null when no secret is configured: the link then needs no token.
 */
export function orderConfirmationToken(orderId: string): string | null {
  const secret = orderLinkSecret();
  return secret ? createHmac("sha256", secret).update(orderId).digest("base64url") : null;
}

/** True when `token` opens this order's confirmation page (always, while no secret is configured). */
export function isOrderConfirmationToken(orderId: string, token: unknown): boolean {
  const expected = orderConfirmationToken(orderId);
  if (expected === null) return true;
  return typeof token === "string" && sameSecret(token, expected);
}
