import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC } from "@/domain/catalog";
import { validateSpec } from "@/domain/rules";
import type { ValidationReport } from "@/domain/types";
import {
  createOrder,
  getOrder,
  listOrders,
  OrderInputError,
  UnbuildableSpecError,
  updateOrderStatus,
  type CreateOrderInput,
} from "./orders";

// The rules engine has its own tests; here it only has to say yes or no.
vi.mock("@/domain/rules", () => ({ validateSpec: vi.fn(() => ({ buildable: true, issues: [] })) }));

const INPUT: CreateOrderInput = {
  spec: DEFAULT_SPEC,
  customer: { name: "  Ada Lovelace ", email: " ada@example.com " },
  notes: " Wrist 17cm ",
};

let dir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  dir = await mkdtemp(path.join(tmpdir(), "orders-test-"));
  vi.stubEnv("ORDERS_DIR", path.join(dir, "orders"));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("createOrder", () => {
  it("prices, builds and persists a buildable design", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));

    const order = await createOrder(INPUT);

    expect(order.id).toMatch(/^ORD-20260927-[0-9A-F]{4}$/);
    expect(order).toMatchObject({
      createdAt: "2026-09-27T10:00:00.000Z",
      status: "received",
      customer: { name: "Ada Lovelace", email: "ada@example.com" },
      notes: "Wrist 17cm",
      spec: DEFAULT_SPEC,
    });
    expect(order.quote.suggestedRetailEur).toBeGreaterThan(order.quote.totalCostEur);
    expect(order.buildSheet.steps.length).toBeGreaterThan(0);

    const files = await readdir(path.join(dir, "orders"));
    expect(files).toEqual([`${order.id}.json`]);
    expect(JSON.parse(await readFile(path.join(dir, "orders", files[0]), "utf8"))).toEqual(order);
  });

  it("rejects a design the rules engine says can't be built, and stores nothing", async () => {
    const report: ValidationReport = {
      buildable: false,
      issues: [{ ruleId: "dial-size", severity: "error", message: "The dial won't seat.", slots: ["dialId"], fixes: [] }],
    };
    vi.mocked(validateSpec).mockReturnValueOnce(report);

    const attempt = createOrder(INPUT);
    await expect(attempt).rejects.toBeInstanceOf(UnbuildableSpecError);
    await expect(attempt).rejects.toMatchObject({ report });
    expect(await listOrders()).toEqual([]);
  });

  it.each<[string, Partial<CreateOrderInput>, string[]]>([
    ["a blank name and a bad email", { customer: { name: "   ", email: "ada@" } }, ["name", "email"]],
    ["an over-long name", { customer: { name: "A".repeat(101), email: "ada@example.com" } }, ["name"]],
    ["an email without a domain", { customer: { name: "Ada", email: "ada@example" } }, ["email"]],
    ["notes over 1000 characters", { notes: "x".repeat(1001) }, ["notes"]],
  ])("rejects %s with a message per field", async (_, changes, fields) => {
    const attempt = createOrder({ ...INPUT, ...changes });
    await expect(attempt).rejects.toBeInstanceOf(OrderInputError);
    const error = (await attempt.catch((caught: unknown) => caught)) as OrderInputError;
    expect(Object.keys(error.fieldErrors).sort()).toEqual([...fields].sort());
    expect(validateSpec).not.toHaveBeenCalled();
  });

  it("accepts a missing notes field and the limits themselves", async () => {
    const order = await createOrder({ spec: DEFAULT_SPEC, customer: { name: "A".repeat(100), email: "a@b.io" } });
    expect(order.notes).toBe("");
  });
});

describe("reading orders", () => {
  it("lists orders newest first and gets each by id", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-27T09:00:00Z"));
    const older = await createOrder(INPUT);
    vi.setSystemTime(new Date("2026-09-28T09:00:00Z"));
    const newer = await createOrder({ ...INPUT, customer: { name: "Grace", email: "grace@example.com" } });

    expect((await listOrders()).map((order) => order.id)).toEqual([newer.id, older.id]);
    expect(await getOrder(older.id)).toEqual(older);
  });

  it("returns an empty list before the first order", async () => {
    expect(await listOrders()).toEqual([]);
  });

  it("returns null for an unknown id", async () => {
    expect(await getOrder("ORD-20260927-0000")).toBeNull();
  });

  it.each(["../secret", "ORD-20260927-7F3A/../../secret", "../../etc/passwd", "ORD-20260927-7f3a", "ORD-2026927-7F3A", ""])(
    "rejects the malformed id %j before it reaches the filesystem",
    async (id) => {
      // Reachable from the orders directory as "../secret.json" if ids weren't checked first.
      await writeFile(path.join(dir, "secret.json"), "{}");
      expect(await getOrder(id)).toBeNull();
      expect(await updateOrderStatus(id, "shipped")).toBeNull();
    },
  );

  it("skips corrupt or foreign files when listing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const order = await createOrder(INPUT);
    const orders = path.join(dir, "orders");
    await writeFile(path.join(orders, "ORD-20260101-AAAA.json"), "{ not json");
    await writeFile(path.join(orders, "ORD-20260101-BBBB.json"), JSON.stringify({ id: "ORD-20260101-CCCC" }));
    await writeFile(path.join(orders, "notes.txt"), "hello");

    expect((await listOrders()).map((listed) => listed.id)).toEqual([order.id]);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("updateOrderStatus", () => {
  it("moves an order along and persists the change", async () => {
    const order = await createOrder(INPUT);
    const updated = await updateOrderStatus(order.id, "assembling");
    expect(updated).toEqual({ ...order, status: "assembling" });
    expect(await getOrder(order.id)).toEqual(updated);
    expect(await readdir(path.join(dir, "orders"))).toEqual([`${order.id}.json`]);
  });

  it("returns null for an order that doesn't exist", async () => {
    expect(await updateOrderStatus("ORD-20260927-0000", "qc")).toBeNull();
  });

  it("rejects a status outside the workflow", async () => {
    const order = await createOrder(INPUT);
    // Simulates an unchecked value arriving from a request body.
    const status = "lost" as Parameters<typeof updateOrderStatus>[1];
    await expect(updateOrderStatus(order.id, status)).rejects.toBeInstanceOf(OrderInputError);
    expect((await getOrder(order.id))?.status).toBe("received");
  });
});
