// Runtime validation for data crossing a trust boundary: API request bodies, the AI designer's
// tool inputs and order files read back from disk. Request schemas check shape and sane sizes only.
// The domain modules own the meaning: the rules engine judges specs and personalization text, the
// order store judges customer details, so each can explain a problem in its own words.
import { z } from "zod";
import { ORDER_STATUSES } from "./orderStatus";
import type {
  BuildSheet,
  ChatTurn,
  Customer,
  DesignRequest,
  Extra,
  Order,
  OrderExtras,
  OrderStatus,
  Part,
  PriceQuote,
  ResolvedExtras,
  ResolvedSpec,
  WatchSpec,
} from "./types";

/** Generous bounds that stop oversized payloads; the real limits live in the domain modules. */
const MAX_PART_ID_LENGTH = 100;
const MAX_PERSONALIZATION_LENGTH = 200;
const MAX_CUSTOMER_FIELD_LENGTH = 500;
const MAX_NOTES_LENGTH = 2000;
/** More add-ons than the extras catalogue holds, with room for it to grow. */
export const MAX_EXTRA_ITEMS = 10;

export const DESIGN_NAME_MAX_LENGTH = 60;
export const DESIGN_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_HISTORY_MAX_TURNS = 20;
export const CHAT_TURN_MAX_LENGTH = 4000;

/** What the order store accepts from a customer. Plain data, so the order form can use it too. */
export const ORDER_LIMITS = { nameMaxLength: 100, emailMaxLength: 254, notesMaxLength: 1000 } as const;

/** Customer-facing wording shared by the order store and the payload caps below. */
export const ORDER_MESSAGES = {
  nameTooLong: `Please keep your name to ${ORDER_LIMITS.nameMaxLength} characters.`,
  badEmail: "That email address doesn't look right.",
  notesTooLong: `Please keep notes to ${ORDER_LIMITS.notesMaxLength} characters.`,
} as const;

/**
 * Largest request body each API route reads, in bytes. Sized so that no body the schemas accept
 * is ever refused: JSON can spend up to 6 bytes on one character ("é").
 */
export const REQUEST_BODY_LIMITS = {
  /** 2,000-char message + 20 turns of 4,000 chars + a spec: about 83k characters. */
  design: 1024 * 1024,
  /** A spec, customer details and 2,000 characters of notes. */
  order: 64 * 1024,
  validate: 16 * 1024,
  orderStatus: 4 * 1024,
} as const;

/**
 * Shortens a design name that is over the limit, at a word boundary when there is one, without
 * splitting a character in two. Names within the limit come back unchanged.
 */
export function clampDesignName(name: string): string {
  if (name.length <= DESIGN_NAME_MAX_LENGTH) return name;
  const characters = [...name.trim()];
  const kept = characters.slice(0, DESIGN_NAME_MAX_LENGTH);
  while (kept.join("").length > DESIGN_NAME_MAX_LENGTH) kept.pop();
  const cut = kept.join("");
  const endsOnWord = kept.length === characters.length || /\s/.test(characters[kept.length]);
  const lastSpace = cut.lastIndexOf(" ");
  return (endsOnWord || lastSpace < DESIGN_NAME_MAX_LENGTH / 2 ? cut : cut.slice(0, lastSpace)).trimEnd();
}

const partIdSchema = z.string().max(MAX_PART_ID_LENGTH);

/**
 * Catalogue ids are lower-case slugs ("strap-nato-olive-20"). Whether one exists is the rules engine's
 * call, which can explain it; this only keeps other text out of the extras.
 */
const catalogIdSchema = z
  .string()
  .max(MAX_PART_ID_LENGTH)
  .regex(/^[a-z0-9][a-z0-9.-]*$/, "Expected a catalogue id.");

export const orderExtrasSchema = z.object({
  // An empty id means no spare strap, as null does.
  spareStrapId: z.union([z.literal("").transform(() => null), catalogIdSchema]).nullable(),
  itemIds: z
    .array(catalogIdSchema)
    .max(MAX_EXTRA_ITEMS)
    .refine((ids) => new Set(ids).size === ids.length, "Each add-on can be added once."),
}) satisfies z.ZodType<OrderExtras>;

export const personalizationSchema = z.object({
  dialText: z.string().max(MAX_PERSONALIZATION_LENGTH),
  casebackEngraving: z.string().max(MAX_PERSONALIZATION_LENGTH),
});

export const watchSpecSchema = z.object({
  name: z.string().max(DESIGN_NAME_MAX_LENGTH),
  movementId: partIdSchema,
  caseId: partIdSchema,
  dialId: partIdSchema,
  handsId: partIdSchema,
  crystalId: partIdSchema,
  // An empty id (older saved designs, hand-written links) means no insert, as null does.
  bezelInsertId: partIdSchema.nullable().transform((id) => (id === "" ? null : id)),
  strapId: partIdSchema,
  personalization: personalizationSchema,
  // Absent on designs, links and orders from before extras existed: no extras.
  extras: orderExtrasSchema.optional(),
}) satisfies z.ZodType<WatchSpec>;

export const customerSchema = z.object({
  name: z.string().max(MAX_CUSTOMER_FIELD_LENGTH, ORDER_MESSAGES.nameTooLong),
  email: z.string().max(MAX_CUSTOMER_FIELD_LENGTH, ORDER_MESSAGES.badEmail),
}) satisfies z.ZodType<Customer>;

export const orderStatusSchema = z.enum(ORDER_STATUSES) satisfies z.ZodType<OrderStatus>;

export const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(CHAT_TURN_MAX_LENGTH),
}) satisfies z.ZodType<ChatTurn>;

export const designRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Tell the designer what you'd like.")
    .max(DESIGN_MESSAGE_MAX_LENGTH, `Please keep your message under ${DESIGN_MESSAGE_MAX_LENGTH} characters.`),
  currentSpec: watchSpecSchema.optional(),
  history: z.array(chatTurnSchema).max(CHAT_HISTORY_MAX_TURNS).optional(),
}) satisfies z.ZodType<DesignRequest>;

// ---------------------------------------------------------------------------
// API request bodies
// ---------------------------------------------------------------------------

export const validateRequestSchema = z.object({ spec: watchSpecSchema });

export const createOrderRequestSchema = z.object({
  spec: watchSpecSchema,
  customer: customerSchema,
  notes: z.string().max(MAX_NOTES_LENGTH, ORDER_MESSAGES.notesTooLong).optional(),
});

export const updateOrderStatusRequestSchema = z.object({ status: orderStatusSchema });

// ---------------------------------------------------------------------------
// Stored orders
// ---------------------------------------------------------------------------

// An order file is trusted only as far as it is checked: these schemas cover every field the order
// pages read, so a damaged or hand-edited file is reported instead of crashing a page. Objects are
// loose, so fields added by later versions don't make older readers reject a file.

const priceQuoteSchema = z
  .looseObject({
    currency: z.literal("EUR"),
    lines: z.array(
      z.looseObject({
        label: z.string(),
        kind: z.enum(["part", "personalization", "extra", "labour", "qc", "overhead"]),
        amountEur: z.number(),
      }),
    ),
    partsCostEur: z.number(),
    personalizationCostEur: z.number(),
    // Quotes from before extras existed had none.
    extrasCostEur: z.number().default(0),
    labourCostEur: z.number(),
    overheadCostEur: z.number(),
    totalCostEur: z.number(),
    suggestedRetailEur: z.number(),
    // Quotes from before VAT was itemised carry no VAT fields: their price was quoted excluding VAT.
    vatRatePct: z.number().optional(),
    vatEur: z.number().optional(),
    retailInclVatEur: z.number().optional(),
    marginPct: z.number(),
    leadTimeDays: z.number(),
    quotedExclVat: z.literal(true).optional(),
  })
  .transform(({ vatRatePct, vatEur, retailInclVatEur, ...quote }) =>
    vatRatePct === undefined
      ? { ...quote, vatRatePct: 0, vatEur: 0, retailInclVatEur: retailInclVatEur ?? quote.suggestedRetailEur, quotedExclVat: true as const }
      : { ...quote, vatRatePct, vatEur: vatEur ?? 0, retailInclVatEur: retailInclVatEur ?? quote.suggestedRetailEur },
  ) satisfies z.ZodType<PriceQuote>;

const buildSheetSchema = z.looseObject({
  title: z.string(),
  summary: z.string(),
  bom: z.array(
    z.looseObject({
      slot: z.enum([
        "movementId",
        "caseId",
        "dialId",
        "handsId",
        "crystalId",
        "bezelInsertId",
        "strapId",
        "personalization",
        "extra",
      ]),
      partId: z.string().nullable(),
      name: z.string(),
      qty: z.number(),
      unitCostEur: z.number(),
      supplierHint: z.string(),
    }),
  ),
  tools: z.array(z.string()),
  steps: z.array(z.looseObject({ title: z.string(), detail: z.string(), cautions: z.array(z.string()) })),
  qcChecks: z.array(z.looseObject({ id: z.string(), label: z.string(), criterion: z.string() })),
  notes: z.array(z.string()),
  estimatedBenchMinutes: z.number(),
}) satisfies z.ZodType<BuildSheet>;

// The parts copied into an order when it was placed. Only what identifies a part is checked; the
// rest is the catalogue's own data from that day, kept as it was.
function storedPartSchema<C extends Part["category"]>(category: C) {
  return z
    .looseObject({ id: z.string(), name: z.string(), category: z.literal(category) })
    .transform((part) => part as unknown as Extract<Part, { category: C }>);
}

const storedPartsSchema = z.object({
  movement: storedPartSchema("movement").optional(),
  case: storedPartSchema("case").optional(),
  dial: storedPartSchema("dial").optional(),
  hands: storedPartSchema("hands").optional(),
  crystal: storedPartSchema("crystal").optional(),
  bezelInsert: storedPartSchema("bezelInsert").optional(),
  strap: storedPartSchema("strap").optional(),
}) satisfies z.ZodType<ResolvedSpec>;

// The extras copied into an order, checked like its parts: only what identifies them.
const storedExtrasSchema = z.object({
  spareStrap: storedPartSchema("strap").optional(),
  items: z.array(
    z.looseObject({ id: z.string(), name: z.string() }).transform((extra) => extra as unknown as Extra),
  ),
}) satisfies z.ZodType<ResolvedExtras>;

export const orderSchema = z.looseObject({
  id: z.string(),
  createdAt: z.iso.datetime(),
  status: orderStatusSchema,
  customer: customerSchema,
  notes: z.string(),
  spec: watchSpecSchema,
  parts: storedPartsSchema.optional(),
  extras: storedExtrasSchema.optional(),
  quote: priceQuoteSchema,
  buildSheet: buildSheetSchema,
}) satisfies z.ZodType<Order>;
