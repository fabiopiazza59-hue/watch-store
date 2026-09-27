// Share links carry the whole design in the URL (`/?d=<base64url JSON>`), so they work without
// any server-side storage. Anything decoded from a URL or browser storage is untrusted: it is
// shape-checked here, and the rules engine still judges whether the parts fit.
import { watchSpecSchema } from "@/domain/schemas";
import type { WatchSpec } from "@/domain/types";

/** Query parameter that holds a shared design. */
export const SHARE_PARAM = "d";

/** Far above any real design (~400 chars); stops pathological URLs before any parsing. */
const MAX_ENCODED_LENGTH = 4096;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/** A design from JSON text, or null when the text isn't a well-formed design. Never throws. */
export function specFromJson(json: string): WatchSpec | null {
  try {
    const parsed = watchSpecSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function encodeSpec(spec: WatchSpec): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(spec)));
}

/** The design in a share link's `d` parameter, or null when it isn't one. Never throws. */
export function decodeSpec(encoded: string): WatchSpec | null {
  if (encoded.length === 0 || encoded.length > MAX_ENCODED_LENGTH) return null;
  try {
    return specFromJson(new TextDecoder().decode(fromBase64Url(encoded)));
  } catch {
    return null;
  }
}

/** Absolute link that opens the configurator on this design. */
export function shareUrl(origin: string, spec: WatchSpec): string {
  const url = new URL("/", origin);
  url.searchParams.set(SHARE_PARAM, encodeSpec(spec));
  return url.toString();
}
