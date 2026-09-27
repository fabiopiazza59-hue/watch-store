import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC, TEMPLATES } from "@/domain/catalog";
import type { Order, WatchSpec } from "@/domain/types";
import { GET as getCatalog } from "./catalog/route";
import { GET as getDesigner, POST as postDesign } from "./design/route";
import { GET as getOrder, PATCH as patchOrder } from "./orders/[id]/route";
import { GET as listOrders, POST as postOrder } from "./orders/route";
import { POST as postValidate } from "./validate/route";

const FIELD = TEMPLATES.find((t) => t.id === "tpl-everyday-field")?.spec as WatchSpec;
const UNBUILDABLE: WatchSpec = { ...FIELD, dialId: "dial-diver-black" };
const CUSTOMER = { name: "Ada Lovelace", email: "ada@example.com" };

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api", {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

let ordersDir: string;

beforeAll(async () => {
  ordersDir = await mkdtemp(path.join(tmpdir(), "atelier-orders-"));
});

afterAll(async () => {
  await rm(ordersDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.stubEnv("ORDERS_DIR", ordersDir);
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  return () => vi.unstubAllEnvs();
});

describe("GET /api/catalog", () => {
  it("returns the parts library, slots and templates", async () => {
    const body = await getCatalog().json();
    expect(Object.keys(body)).toEqual(["catalog", "slots", "templates"]);
    expect(body.catalog.cases.length).toBeGreaterThan(0);
  });
});

describe("POST /api/validate", () => {
  it("returns the report and quote for a spec", async () => {
    const response = await postValidate(jsonRequest("POST", { spec: DEFAULT_SPEC }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.report.buildable).toBe(true);
    expect(body.quote.suggestedRetailEur).toBeGreaterThan(0);
  });

  it("rejects bad JSON and malformed specs with a 400 and field messages", async () => {
    const badJson = await postValidate(jsonRequest("POST", "{not json"));
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toEqual({ error: "The request body must be valid JSON." });

    const malformed = await postValidate(jsonRequest("POST", { spec: { ...DEFAULT_SPEC, caseId: 5 } }));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).fields).toHaveProperty(["spec.caseId"]);
  });
});

describe("/api/design", () => {
  it("reports offline mode without an API key", async () => {
    expect(await getDesigner().json()).toEqual({ mode: "offline", model: null });
  });

  it("designs from a message", async () => {
    const response = await postDesign(jsonRequest("POST", { message: "a 38mm green field watch", currentSpec: DEFAULT_SPEC }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("offline");
    expect(body.report.buildable).toBe(true);
    expect(body.changes).toContain("Case: Classic Diver 42 → Field 38");
  });

  it("rejects an empty message", async () => {
    const response = await postDesign(jsonRequest("POST", { message: "  " }));
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toEqual({ message: "Tell the designer what you'd like." });
  });
});

describe("/api/orders", () => {
  it("places, lists, reads and advances an order", async () => {
    const created = await postOrder(jsonRequest("POST", { spec: FIELD, customer: CUSTOMER, notes: "A gift" }));
    expect(created.status).toBe(201);
    const order: Order = await created.json();
    expect(order).toMatchObject({ status: "received", customer: CUSTOMER, spec: FIELD });

    const listed: Order[] = await (await listOrders()).json();
    expect(listed.map((o) => o.id)).toContain(order.id);

    const read = await getOrder(new Request("http://localhost"), context(order.id));
    expect((await read.json()).id).toBe(order.id);

    const moved = await patchOrder(jsonRequest("PATCH", { status: "parts-ordered" }), context(order.id));
    expect(moved.status).toBe(200);
    expect((await moved.json()).status).toBe("parts-ordered");
  });

  it("returns field messages keyed by body path for bad customer details", async () => {
    const response = await postOrder(jsonRequest("POST", { spec: FIELD, customer: { name: "Ada", email: "nope" } }));
    expect(response.status).toBe(400);
    expect(Object.keys((await response.json()).fields)).toEqual(["customer.email"]);
  });

  it("refuses unbuildable designs with the rules report", async () => {
    const response = await postOrder(jsonRequest("POST", { spec: UNBUILDABLE, customer: CUSTOMER }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.report.buildable).toBe(false);
  });

  it("answers 404 for unknown orders and 400 for unknown statuses", async () => {
    expect((await getOrder(new Request("http://localhost"), context("ORD-20260101-FFFF"))).status).toBe(404);
    expect((await getOrder(new Request("http://localhost"), context("../../etc/passwd"))).status).toBe(404);
    expect((await patchOrder(jsonRequest("PATCH", { status: "qc" }), context("ORD-20260101-FFFF"))).status).toBe(404);
    const badStatus = await patchOrder(jsonRequest("PATCH", { status: "lost" }), context("ORD-20260101-FFFF"));
    expect(badStatus.status).toBe(400);
    expect((await badStatus.json()).fields).toHaveProperty("status");
  });
});
