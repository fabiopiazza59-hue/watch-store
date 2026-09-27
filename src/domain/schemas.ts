// Runtime validation for data crossing a trust boundary: API request bodies and the AI designer's
// tool inputs. Schemas check shape and sane sizes only. The domain modules own the meaning: the
// rules engine judges specs and personalization text, the order store judges customer details, so
// each can explain a problem in its own words.
import { z } from "zod";
import { ORDER_STATUSES } from "./orderStatus";
import type { ChatTurn, Customer, DesignRequest, OrderStatus, WatchSpec } from "./types";

/** Generous bounds that stop oversized payloads; the real limits live in the domain modules. */
const MAX_PART_ID_LENGTH = 100;
const MAX_PERSONALIZATION_LENGTH = 200;
const MAX_CUSTOMER_FIELD_LENGTH = 500;
const MAX_NOTES_LENGTH = 2000;

export const DESIGN_NAME_MAX_LENGTH = 60;
export const DESIGN_MESSAGE_MAX_LENGTH = 2000;
export const CHAT_HISTORY_MAX_TURNS = 20;
export const CHAT_TURN_MAX_LENGTH = 4000;

const partIdSchema = z.string().max(MAX_PART_ID_LENGTH);

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
  bezelInsertId: partIdSchema.nullable(),
  strapId: partIdSchema,
  personalization: personalizationSchema,
}) satisfies z.ZodType<WatchSpec>;

export const customerSchema = z.object({
  name: z.string().max(MAX_CUSTOMER_FIELD_LENGTH),
  email: z.string().max(MAX_CUSTOMER_FIELD_LENGTH),
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
  notes: z.string().max(MAX_NOTES_LENGTH).optional(),
});

export const updateOrderStatusRequestSchema = z.object({ status: orderStatusSchema });
