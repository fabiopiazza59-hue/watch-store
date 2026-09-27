import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, TEMPLATES } from "./catalog";
import {
  createOrderRequestSchema,
  designRequestSchema,
  updateOrderStatusRequestSchema,
  watchSpecSchema,
} from "./schemas";

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
