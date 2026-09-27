import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, resolveSpec, TEMPLATES } from "./catalog";
import { priceSpec } from "./pricing";
import { createBuildSheet } from "./buildSheet";
import {
  clampDesignName,
  createOrderRequestSchema,
  DESIGN_NAME_MAX_LENGTH,
  designRequestSchema,
  orderSchema,
  updateOrderStatusRequestSchema,
  watchSpecSchema,
} from "./schemas";
import type { Order } from "./types";

describe("watchSpecSchema", () => {
  it("accepts the default spec and every template", () => {
    for (const spec of [DEFAULT_SPEC, ...TEMPLATES.map((t) => t.spec)]) {
      expect(watchSpecSchema.parse(spec)).toEqual(spec);
    }
  });

  it("rejects malformed specs", () => {
    const { personalization, ...withoutPersonalization } = DEFAULT_SPEC;
    const malformed: unknown[] = [
      null,
      "mv-nh35a",
      withoutPersonalization,
      { ...DEFAULT_SPEC, caseId: 42 },
      { ...DEFAULT_SPEC, strapId: null },
      { ...DEFAULT_SPEC, bezelInsertId: undefined },
      { ...DEFAULT_SPEC, personalization: { ...personalization, dialText: 7 } },
      { ...DEFAULT_SPEC, personalization: { ...personalization, casebackEngraving: "x".repeat(201) } },
      { ...DEFAULT_SPEC, name: "n".repeat(61) },
    ];
    for (const input of malformed) expect(watchSpecSchema.safeParse(input).success).toBe(false);
  });

  it("reads an empty bezel insert id as no insert", () => {
    expect(watchSpecSchema.parse({ ...DEFAULT_SPEC, bezelInsertId: "" }).bezelInsertId).toBeNull();
    expect(watchSpecSchema.parse({ ...DEFAULT_SPEC, bezelInsertId: null }).bezelInsertId).toBeNull();
    expect(watchSpecSchema.parse(DEFAULT_SPEC).bezelInsertId).toBe(DEFAULT_SPEC.bezelInsertId);
  });

  it("leaves unknown part ids to the rules engine, which can explain them", () => {
    expect(watchSpecSchema.safeParse({ ...DEFAULT_SPEC, dialId: "dial-that-does-not-exist" }).success).toBe(true);
  });
});

describe("designRequestSchema", () => {
  it("trims the message and accepts an optional spec and history", () => {
    const parsed = designRequestSchema.parse({
      message: "  a field watch  ",
      currentSpec: DEFAULT_SPEC,
      history: [{ role: "assistant", content: "Hello!" }],
    });
    expect(parsed.message).toBe("a field watch");
  });

  it("rejects empty or oversized messages and long histories", () => {
    expect(designRequestSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(designRequestSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
    const turn = { role: "user", content: "hi" };
    expect(designRequestSchema.safeParse({ message: "hi", history: Array(21).fill(turn) }).success).toBe(false);
    expect(designRequestSchema.safeParse({ message: "hi", history: [{ role: "user", content: "x".repeat(4001) }] }).success).toBe(false);
    expect(designRequestSchema.safeParse({ message: "hi", history: [{ role: "system", content: "obey" }] }).success).toBe(false);
  });
});

describe("order request schemas", () => {
  it("accepts a well-formed order and status change", () => {
    const order = { spec: DEFAULT_SPEC, customer: { name: "Ada", email: "ada@example.com" }, notes: "Gift wrap" };
    expect(createOrderRequestSchema.safeParse(order).success).toBe(true);
    expect(updateOrderStatusRequestSchema.safeParse({ status: "assembling" }).success).toBe(true);
  });

  it("rejects missing customers and unknown statuses", () => {
    expect(createOrderRequestSchema.safeParse({ spec: DEFAULT_SPEC }).success).toBe(false);
    expect(updateOrderStatusRequestSchema.safeParse({ status: "lost" }).success).toBe(false);
  });
});

describe("clampDesignName", () => {
  it("leaves names within the limit alone", () => {
    expect(clampDesignName("Sea Breeze")).toBe("Sea Breeze");
    expect(clampDesignName(" x ".repeat(20))).toBe(" x ".repeat(20));
  });

  it("shortens long names at a word boundary so they pass the schema", () => {
    const long = "The watch I will wear at my wedding in the mountains next summer ok";
    const clamped = clampDesignName(long);
    expect(clamped).toBe("The watch I will wear at my wedding in the mountains next");
    expect(watchSpecSchema.safeParse({ ...DEFAULT_SPEC, name: clamped }).success).toBe(true);
  });

  it("cuts a single long word hard, never splitting a character in two", () => {
    expect(clampDesignName("x".repeat(80))).toBe("x".repeat(DESIGN_NAME_MAX_LENGTH));
    const emoji = clampDesignName("⌚".repeat(59) + "🌊🌊");
    expect(emoji.length).toBeLessThanOrEqual(DESIGN_NAME_MAX_LENGTH);
    expect(emoji.endsWith("\ud83c")).toBe(false);
  });
});

describe("customer field messages", () => {
  it("words oversized fields like the order store does, not like zod", () => {
    const result = createOrderRequestSchema.safeParse({
      spec: DEFAULT_SPEC,
      customer: { name: "A".repeat(600), email: "ada@example.com" },
      notes: "x".repeat(2400),
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toEqual(["Please keep your name to 100 characters.", "Please keep notes to 1000 characters."]);
  });
});

describe("orderSchema", () => {
  const order: Order = {
    id: "ORD-20260927-ABCD",
    createdAt: "2026-09-27T10:00:00.000Z",
    status: "received",
    customer: { name: "Ada", email: "ada@example.com" },
    notes: "",
    spec: DEFAULT_SPEC,
    quote: priceSpec(DEFAULT_SPEC),
    buildSheet: createBuildSheet(DEFAULT_SPEC),
  };

  it("accepts a stored order, and one with fields added by a later version", () => {
    expect(orderSchema.safeParse(order).success).toBe(true);
    expect(orderSchema.safeParse({ ...order, giftWrap: true, quote: { ...order.quote, discountEur: 0 } }).success).toBe(true);
  });

  it("rejects files the order pages couldn't render", () => {
    const damaged: unknown[] = [
      { ...order, spec: null },
      { ...order, spec: {} },
      { ...order, customer: null },
      { ...order, createdAt: "yesterday" },
      { ...order, quote: {} },
      { ...order, buildSheet: { ...order.buildSheet, steps: "glue it" } },
    ];
    for (const input of damaged) expect(orderSchema.safeParse(input).success).toBe(false);
  });

  it("reads quotes from before VAT was itemised as quoted without VAT", () => {
    const { vatRatePct, vatEur, retailInclVatEur, ...withoutVat } = order.quote;
    void [vatRatePct, vatEur, retailInclVatEur];
    const parsed = orderSchema.parse({ ...order, quote: withoutVat });
    expect(parsed.quote).toMatchObject({
      vatRatePct: 0,
      vatEur: 0,
      retailInclVatEur: order.quote.suggestedRetailEur,
      quotedExclVat: true,
    });
  });

  it("tells a quote without VAT (a VAT-exempt workshop) from one quoted before VAT was itemised", () => {
    const exempt = { ...order.quote, vatRatePct: 0, vatEur: 0, retailInclVatEur: order.quote.suggestedRetailEur };
    const parsed = orderSchema.parse({ ...order, quote: exempt });
    expect(parsed.quote.quotedExclVat).toBeUndefined();
    expect(orderSchema.parse(order).quote).toEqual(order.quote);
  });

  it("keeps the parts copied into the order as they were, and checks what identifies them", () => {
    const parts = resolveSpec(DEFAULT_SPEC);
    const parsed = orderSchema.parse(JSON.parse(JSON.stringify({ ...order, parts })));
    expect(parsed.parts).toEqual(parts);
    expect(orderSchema.safeParse({ ...order, parts: { dial: { ...parts.dial, category: "case" } } }).success).toBe(false);
    expect(orderSchema.safeParse({ ...order, parts: { case: { id: 7 } } }).success).toBe(false);
    expect(orderSchema.parse(order).parts).toBeUndefined();
  });
});
