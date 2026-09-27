// Share links carry the whole design in the URL (`/?d=<base64url JSON>`), so they work without
// any server-side storage. Anything decoded from a URL or browser storage is untrusted: it is
// shape-checked here, and the rules engine still judges whether the parts fit.
import { CATALOG, EXTRAS, PERSONALIZATION_LIMITS } from "@/domain/catalog";
import { normalizePersonalizationText, reviewText } from "@/domain/rules";
import { clampDesignName, watchSpecSchema } from "@/domain/schemas";
import type { OrderExtras, Personalization, WatchSpec } from "@/domain/types";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Far above the six add-ons there are; stops a pathological list before it is looked at. */
const MAX_LINKED_EXTRA_ITEMS = 50;

/**
 * The extras of a saved or linked design. Anything malformed means none (undefined), rather than
 * losing the whole design over it. Ids the catalogue doesn't list are dropped, and the add-ons put
 * in catalogue order, each once; a strap that doesn't fit the case is kept, for the rules engine
 * to flag with a fix.
 */
function readExtras(value: unknown): OrderExtras | undefined {
  if (!isRecord(value)) return undefined;
  const { spareStrapId = null, itemIds = [] } = value;
  if (spareStrapId !== null && typeof spareStrapId !== "string") return undefined;
  if (!Array.isArray(itemIds) || itemIds.length > MAX_LINKED_EXTRA_ITEMS) return undefined;
  if (!itemIds.every((id): id is string => typeof id === "string")) return undefined;
  return {
    spareStrapId: CATALOG.straps.some((strap) => strap.id === spareStrapId) ? spareStrapId : null,
    itemIds: EXTRAS.filter((extra) => itemIds.includes(extra.id)).map((extra) => extra.id),
  };
}

/** The design without its extras, checked against the schema; a name over the limit is shortened. */
function readDesign(value: Record<string, unknown>): WatchSpec | null {
  const parsed = watchSpecSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const onlyTheName = parsed.error.issues.every((issue) => issue.path.length === 1 && issue.path[0] === "name");
  if (!onlyTheName || typeof value.name !== "string") return null;
  const renamed = watchSpecSchema.safeParse({ ...value, name: clampDesignName(value.name) });
  return renamed.success ? renamed.data : null;
}

/**
 * A design from JSON text, or null when the text isn't a well-formed design. Never throws.
 * A design whose only problem is a name over the length limit (saved by an older version) is kept,
 * with the name shortened, rather than lost. Its extras are read on their own (see readExtras), so
 * a design from before extras existed, or with extras that make no sense, still opens.
 */
export function specFromJson(json: string): WatchSpec | null {
  try {
    const value: unknown = JSON.parse(json);
    if (!isRecord(value)) return null;
    const { extras, ...design } = value;
    const spec = readDesign(design);
    if (!spec) return null;
    const read = readExtras(extras);
    if (read) return { ...spec, extras: read };
    delete spec.extras;
    return spec;
  } catch {
    return null;
  }
}

export function encodeSpec(spec: WatchSpec): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(spec)));
}

/** Characters a design name from a link may keep: letters, digits, spaces and . , ' & - */
const NAME_DISALLOWED = /[^\p{L}\p{M}\p{N} .,'&-]/gu;

/**
 * A personal text from a link, or "" when it could never be printed or engraved: characters outside
 * the allowed set, another brand, a Swiss indication, or far over the limit. A link is written by
 * whoever sent it, so such text is dropped before it reaches the preview, the designer or an order.
 */
function linkText(text: string, maxLength: number): string {
  const plain = normalizePersonalizationText(text);
  const review = reviewText(plain);
  const refused =
    review.disallowedCharacters.length > 0 ||
    review.trademarks.length > 0 ||
    review.protectedIndications.length > 0 ||
    review.length > 2 * maxLength;
  return refused ? "" : plain;
}

function linkPersonalization({ dialText, casebackEngraving }: Personalization): Personalization {
  return {
    dialText: linkText(dialText, PERSONALIZATION_LIMITS.dialTextMaxLength),
    casebackEngraving: linkText(casebackEngraving, PERSONALIZATION_LIMITS.casebackEngravingMaxLength),
  };
}

function linkName(name: string): string {
  const plain = normalizePersonalizationText(name).replace(NAME_DISALLOWED, "").replace(/\s+/g, " ").trim();
  return clampDesignName(plain);
}

/**
 * The design in a share link's `d` parameter, or null when it isn't one. Never throws. Its texts
 * are cleaned as they come in (see linkText); the parts are left for the rules engine to judge.
 */
export function decodeSpec(encoded: string): WatchSpec | null {
  if (encoded.length === 0 || encoded.length > MAX_ENCODED_LENGTH) return null;
  try {
    const spec = specFromJson(new TextDecoder().decode(fromBase64Url(encoded)));
    if (!spec) return null;
    return { ...spec, name: linkName(spec.name), personalization: linkPersonalization(spec.personalization) };
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
