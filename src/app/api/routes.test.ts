import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC, TEMPLATES } from "@/domain/catalog";
import { REQUEST_BODY_LIMITS } from "@/domain/schemas";
import type { Order, WatchSpec } from "@/domain/types";
import { isOrderConfirmationToken } from "@/server/workshopAuth";
import { GET as getCatalog } from "./catalog/route";
import { GET as getDesigner, POST as postDesign } from "./design/route";
import { GET as getOrder, PATCH as patchOrder } from "./orders/[id]/route";
import { GET as listOrders, POST as postOrder } from "./orders/route";
import { POST as postValidate } from "./validate/route";

const FIELD = TEMPLATES.find((t) => t.id === "tpl-everyday-field")?.spec as WatchSpec;
const UNBUILDABLE: WatchSpec = { ...FIELD, dialId: "dial-diver-black" };
const CUSTOMER = { name: "Ada Lovelace", email: "ada@example.com" };

function jsonRequest(method: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** A body streamed in chunks with no Content-Length, as a chunked upload arrives. */
function streamedRequest(chunks: string[]): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
}

const listRequest = (query = "", headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/orders${query}`, { headers });

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

describe("request guards", () => {
  const body = JSON.stringify({ spec: DEFAULT_SPEC });

  it.each([
    ["text/plain", "text/plain;charset=UTF-8"],
    ["a JSON parameter on another type", "text/plain; x=application/json"],
    ["form encoding", "application/x-www-form-urlencoded"],
  ])("refuses a body sent as %s with a 415", async (_, contentType) => {
    const response = await postValidate(new Request("http://localhost/api", { method: "POST", headers: { "content-type": contentType }, body }));
    expect(response.status).toBe(415);
  });

  it("refuses a body with no content type", async () => {
    const request = new Request("http://localhost/api", { method: "POST", body: new Blob([body]) });
    expect(request.headers.get("content-type")).toBeNull();
    expect((await postValidate(request)).status).toBe(415);
  });

  it("accepts JSON with a charset", async () => {
    const response = await postValidate(jsonRequest("POST", body, { "content-type": "application/json; charset=utf-8" }));
    expect(response.status).toBe(200);
  });

  it("refuses a declared length over the route's limit before reading the body", async () => {
    const request = jsonRequest("POST", body, { "content-length": String(REQUEST_BODY_LIMITS.validate + 1) });
    const response = await postValidate(request);
    expect(response.status).toBe(413);
    expect(request.bodyUsed).toBe(false);
  });

  it("stops reading a streamed body once it passes the limit", async () => {
    const chunk = `"${"A".repeat(4096)}",`;
    const request = streamedRequest([`{"spec":${JSON.stringify(DEFAULT_SPEC)},"junk":[`, ...Array(10).fill(chunk), `""]}`]);
    const response = await postValidate(request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "The request is too large." });
  });

  it("reads a streamed body within the limit", async () => {
    const response = await postValidate(streamedRequest([`{"spec":`, JSON.stringify(DEFAULT_SPEC), "}"]));
    expect(response.status).toBe(200);
  });

  it("refuses requests a browser labels as coming from another site", async () => {
    const crossSite = await postValidate(jsonRequest("POST", body, { "sec-fetch-site": "cross-site" }));
    expect(crossSite.status).toBe(403);
    expect((await postValidate(jsonRequest("POST", body, { "sec-fetch-site": "same-origin" }))).status).toBe(200);
  });

  it("refuses another origin when the public origin is configured", async () => {
    vi.stubEnv("PUBLIC_ORIGIN", "https://atelier.example/");
    expect((await postValidate(jsonRequest("POST", body, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await postValidate(jsonRequest("POST", body, { origin: "https://atelier.example" }))).status).toBe(200);
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

    const listed: { orders: { id: string }[]; nextBefore: string | null } = await (await listOrders(listRequest())).json();
    expect(listed.orders.map((o) => o.id)).toContain(order.id);
    expect(listed.orders[0]).not.toHaveProperty("buildSheet");

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

  it("words over-long details the same way whether the schema or the order store catches them", async () => {
    for (const name of ["A".repeat(150), "A".repeat(600)]) {
      const response = await postOrder(jsonRequest("POST", { spec: FIELD, customer: { ...CUSTOMER, name } }));
      expect(response.status).toBe(400);
      expect((await response.json()).fields).toEqual({ "customer.name": "Please keep your name to 100 characters." });
    }
  });

  it("returns a confirmation token that opens only this order's confirmation", async () => {
    vi.stubEnv("ORDER_LINK_SECRET", "link-secret");
    const created = await postOrder(jsonRequest("POST", { spec: FIELD, customer: CUSTOMER }));
    const { id, confirmationToken } = await created.json();
    expect(typeof confirmationToken).toBe("string");
    expect(isOrderConfirmationToken(id, confirmationToken)).toBe(true);
    expect(isOrderConfirmationToken("ORD-20260101-FFFF", confirmationToken)).toBe(false);
  });

  it("limits how many orders one client places, counting only orders placed", async () => {
    const from = { "x-forwarded-for": "203.0.113.7" };
    const invalid = await postOrder(jsonRequest("POST", { spec: FIELD, customer: { name: "Ada", email: "nope" } }, from));
    expect(invalid.status).toBe(400);
    for (let i = 0; i < 5; i++) {
      expect((await postOrder(jsonRequest("POST", { spec: FIELD, customer: CUSTOMER }, from))).status).toBe(201);
    }
    const limited = await postOrder(jsonRequest("POST", { spec: FIELD, customer: CUSTOMER }, from));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    const other = await postOrder(jsonRequest("POST", { spec: FIELD, customer: CUSTOMER }, { "x-forwarded-for": "203.0.113.8" }));
    expect(other.status).toBe(201);
  });

  it("stops taking orders past the daily limit", async () => {
    vi.stubEnv("ORDERS_DAILY_LIMIT", "1");
    const response = await postOrder(jsonRequest("POST", { spec: FIELD, customer: CUSTOMER }, { "x-forwarded-for": "198.51.100.1" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/not taking more orders today/);
  });

  it("names a damaged order file instead of failing blindly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await writeFile(path.join(ordersDir, "ORD-20260101-DDDD.json"), JSON.stringify({ id: "ORD-20260101-DDDD", spec: null }));
    const response = await getOrder(new Request("http://localhost"), context("ORD-20260101-DDDD"));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/ORD-20260101-DDDD\.json is damaged/);
    await rm(path.join(ordersDir, "ORD-20260101-DDDD.json"));
    vi.restoreAllMocks();
  });

  it("pages the order list and rejects a malformed cursor", async () => {
    const page = await (await listOrders(listRequest("?limit=1"))).json();
    expect(page.orders).toHaveLength(1);
    expect(typeof page.nextBefore).toBe("string");
    expect((await listOrders(listRequest("?before=../../etc"))).status).toBe(400);
    expect((await listOrders(listRequest("?limit=5000"))).status).toBe(400);
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

describe("the workshop gate", () => {
  const token = "workshop-secret";
  const bearer = { authorization: `Bearer ${token}` };

  it("keeps order lists, order details and status changes to the workshop once a token is set", async () => {
    const created = await postOrder(jsonRequest("POST", { spec: FIELD, customer: CUSTOMER }, { "x-forwarded-for": "192.0.2.50" }));
    const { id } = await created.json();
    vi.stubEnv("WORKSHOP_TOKEN", token);

    expect((await listOrders(listRequest())).status).toBe(401);
    expect((await getOrder(new Request("http://localhost"), context(id))).status).toBe(401);
    expect((await patchOrder(jsonRequest("PATCH", { status: "qc" }), context(id))).status).toBe(401);
    expect((await listOrders(listRequest("", { authorization: "Bearer wrong" }))).status).toBe(401);

    expect((await listOrders(listRequest("", bearer))).status).toBe(200);
    expect((await getOrder(new Request("http://localhost", { headers: bearer }), context(id))).status).toBe(200);
    const cookie = { cookie: `theme=dark; atelier_workshop=${token}` };
    expect((await patchOrder(jsonRequest("PATCH", { status: "qc" }, cookie), context(id))).status).toBe(200);
  });

  it("still lets customers place orders", async () => {
    vi.stubEnv("WORKSHOP_TOKEN", token);
    const created = await postOrder(jsonRequest("POST", { spec: FIELD, customer: CUSTOMER }, { "x-forwarded-for": "192.0.2.51" }));
    expect(created.status).toBe(201);
    const { id, confirmationToken } = await created.json();
    expect(isOrderConfirmationToken(id, confirmationToken)).toBe(true);
    expect(isOrderConfirmationToken(id, "forged")).toBe(false);
  });
});
