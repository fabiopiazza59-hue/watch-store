import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC, resolveSpec } from "@/domain/catalog";
import { validateSpec } from "@/domain/rules";
import type { ValidationReport } from "@/domain/types";
import type { Order } from "@/domain/types";
import {
  CorruptOrderError,
  createOrder,
  getOrder,
  listOrderPage,
  listOrderSummaries,
  OrderCapacityError,
  OrderInputError,
  UnbuildableSpecError,
  updateOrderStatus,
  type CreateOrderInput,
} from "./orders";

// The rules engine has its own tests; here it only has to say yes or no.
vi.mock("@/domain/rules", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domain/rules")>()),
  validateSpec: vi.fn(() => ({ buildable: true, issues: [] })),
}));
// Real randomness unless a test scripts the id suffix.
vi.mock("node:crypto", async (importOriginal) => {
  const crypto = await importOriginal<typeof import("node:crypto")>();
  return { ...crypto, randomBytes: vi.fn(crypto.randomBytes) };
});

/** The first page of orders, newest first. */
async function listOrders() {
  return (await listOrderPage()).orders;
}

/** Makes the next id draws use these suffixes (16 hex digits each). */
function scriptIdSuffixes(...suffixes: string[]) {
  for (const suffix of suffixes) {
    vi.mocked(randomBytes).mockImplementationOnce(() => Buffer.from(suffix, "hex"));
  }
}

const INPUT: CreateOrderInput = {
  spec: DEFAULT_SPEC,
  customer: { name: "  Ada Lovelace ", email: " ada@example.com " },
  notes: " Wrist 17cm ",
};

let dir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(randomBytes).mockReset();
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

    expect(order.id).toMatch(/^ORD-20260927-[0-9A-F]{16}$/);
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
    [
      "an email that would add recipients to a mailto: link",
      { customer: { name: "Ada", email: "victim@b.cc?cc=attacker%40evil.example&subject=x" } },
      ["email"],
    ],
    ["an email with a fragment", { customer: { name: "Ada", email: "a@b.cc#frag" } }, ["email"]],
    ["an email with a path", { customer: { name: "Ada", email: "a@b.cc/x" } }, ["email"]],
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

  it.each(["o'brien@example.ie", "a+tag@example.com"])("accepts the ordinary address %s", async (email) => {
    const order = await createOrder({ ...INPUT, customer: { name: "Ada", email } });
    expect(order.customer.email).toBe(email);
  });

  it("stores texts typed with smart punctuation in plain ASCII, and judges them that way", async () => {
    const spec = { ...DEFAULT_SPEC, personalization: { dialText: "Grandpa’s watch", casebackEngraving: "1953 – 2026" } };
    const order = await createOrder({ ...INPUT, spec });
    const plain = { dialText: "Grandpa's watch", casebackEngraving: "1953 - 2026" };
    expect(order.spec.personalization).toEqual(plain);
    expect(vi.mocked(validateSpec).mock.calls[0][0].personalization).toEqual(plain);
    expect((await getOrder(order.id))?.spec.personalization).toEqual(plain);
  });

  it("keeps a copy of the parts as ordered, which outlives the catalogue entry", async () => {
    const order = await createOrder(INPUT);
    expect(order.parts).toEqual(resolveSpec(DEFAULT_SPEC));

    // Later the dial is retired from the catalogue: the order still says what was ordered.
    const file = path.join(dir, "orders", `${order.id}.json`);
    const stored = JSON.parse(await readFile(file, "utf8")) as Order;
    const retired = { ...stored.parts!.dial!, id: "dial-retired", name: "Retired dial" };
    await writeFile(file, JSON.stringify({ ...stored, spec: { ...stored.spec, dialId: "dial-retired" }, parts: { ...stored.parts, dial: retired } }));

    const read = await getOrder(order.id);
    expect(resolveSpec(read!.spec).dial).toBeUndefined();
    expect(read?.parts?.dial).toEqual(retired);
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

  it.each<[string, (order: Order) => unknown]>([
    ["a null spec", (order) => ({ ...order, spec: null })],
    ["an empty spec", (order) => ({ ...order, spec: {} })],
    ["a null customer", (order) => ({ ...order, customer: null })],
    ["an unreadable date", (order) => ({ ...order, createdAt: "yesterday" })],
    ["an empty quote", (order) => ({ ...order, quote: {} })],
    ["an empty build sheet", (order) => ({ ...order, buildSheet: {} })],
  ])("treats a file with %s as damaged: skipped in lists, an error when opened", async (_, damage) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const order = await createOrder(INPUT);
    const id = "ORD-20260101-AAAA";
    await writeFile(path.join(dir, "orders", `${id}.json`), JSON.stringify(damage({ ...order, id })));

    expect((await listOrders()).map((listed) => listed.id)).toEqual([order.id]);
    expect(warn).toHaveBeenCalledTimes(1);
    await expect(getOrder(id)).rejects.toBeInstanceOf(CorruptOrderError);
    await expect(getOrder(id)).rejects.toMatchObject({ orderId: id });
    await expect(updateOrderStatus(id, "shipped")).rejects.toBeInstanceOf(CorruptOrderError);
  });

  it("still reads orders saved with the older, 4-digit ids", async () => {
    const order = await createOrder(INPUT);
    const old = { ...order, id: "ORD-20260101-7F3A" };
    await writeFile(path.join(dir, "orders", `${old.id}.json`), JSON.stringify(old));
    expect(await getOrder(old.id)).toEqual(old);
  });
});

describe("paging through orders", () => {
  async function seedOrders(count: number): Promise<string[]> {
    const template = await createOrder(INPUT);
    await rm(path.join(dir, "orders", `${template.id}.json`));
    const ids = Array.from({ length: count }, (_, i) => `ORD-2026${String(Math.floor(i / 28) + 1).padStart(2, "0")}${String((i % 28) + 1).padStart(2, "0")}-${i.toString(16).toUpperCase().padStart(16, "0")}`);
    await Promise.all(
      ids.map((id, i) =>
        writeFile(
          path.join(dir, "orders", `${id}.json`),
          JSON.stringify({ ...template, id, createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString() }),
        ),
      ),
    );
    return ids;
  }

  it("lists at most a page of the newest orders, with a cursor for the rest", async () => {
    const ids = await seedOrders(150);
    const newestFirst = [...ids].reverse();

    const first = await listOrderPage();
    expect(first.orders.map((order) => order.id)).toEqual(newestFirst.slice(0, 100));
    expect(first.nextBefore).toBe(newestFirst[99]);

    const second = await listOrderPage({ before: first.nextBefore ?? undefined });
    expect(second.orders.map((order) => order.id)).toEqual(newestFirst.slice(100));
    expect(second.nextBefore).toBeNull();
    expect((await listOrderPage({ limit: 1000 })).orders).toHaveLength(100);
  });

  it("summarises orders without their spec, quote or build sheet", async () => {
    await seedOrders(3);
    const { orders, nextBefore } = await listOrderSummaries({ limit: 2 });
    expect(orders).toHaveLength(2);
    expect(nextBefore).not.toBeNull();
    expect(Object.keys(orders[0]).sort()).toEqual(["createdAt", "customer", "designName", "id", "retailInclVatEur", "status"]);
    expect(orders[0]).toMatchObject({ designName: DEFAULT_SPEC.name, customer: { name: "Ada Lovelace" } });
  });
});

describe("order ids", () => {
  it("never overwrites an order that already has the id drawn, even when created at the same moment", async () => {
    scriptIdSuffixes("00000000000000AB", "00000000000000AB", "00000000000000CD");
    const [alice, bob] = await Promise.all([
      createOrder({ ...INPUT, customer: { name: "Alice", email: "alice@example.com" } }),
      createOrder({ ...INPUT, customer: { name: "Bob", email: "bob@example.com" } }),
    ]);
    expect(alice.id).not.toBe(bob.id);
    expect((await readdir(path.join(dir, "orders"))).sort()).toEqual([`${alice.id}.json`, `${bob.id}.json`].sort());
    expect((await getOrder(alice.id))?.customer.name).toBe("Alice");
    expect((await getOrder(bob.id))?.customer.name).toBe("Bob");
  });

  it("gives up after a few draws instead of spinning when every id it draws is taken", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
    const taken = await createOrder(INPUT);
    vi.mocked(randomBytes).mockImplementation(() => Buffer.from(taken.id.slice(-16), "hex"));

    await expect(createOrder(INPUT)).rejects.toThrow(/unused order id/);
    expect(await readdir(path.join(dir, "orders"))).toEqual([`${taken.id}.json`]);
  });

  it("stops taking orders for the day at ORDERS_DAILY_LIMIT", async () => {
    vi.stubEnv("ORDERS_DAILY_LIMIT", "2");
    await createOrder(INPUT);
    await createOrder(INPUT);
    await expect(createOrder(INPUT)).rejects.toBeInstanceOf(OrderCapacityError);
    expect(await readdir(path.join(dir, "orders"))).toHaveLength(2);
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
