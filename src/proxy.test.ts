import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

const request = (method: string, path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, "http://localhost:3000"), { method, headers });

/** NextResponse.next() lets the request through to the route. */
const passes = (response: Response) => response.headers.get("x-middleware-next") === "1";

describe("proxy for the order API", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lets everything through while no workshop token is set", () => {
    vi.stubEnv("WORKSHOP_TOKEN", "");
    expect(passes(proxy(request("GET", "/api/orders")))).toBe(true);
    expect(passes(proxy(request("PATCH", "/api/orders/ORD-20260927-ABCD")))).toBe(true);
  });

  it("refuses workshop requests without the token, but lets customers place orders", async () => {
    vi.stubEnv("WORKSHOP_TOKEN", "bench-key");
    const refused = proxy(request("GET", "/api/orders"));
    expect(refused.status).toBe(401);
    expect(await refused.json()).toMatchObject({ error: expect.stringContaining("Only the workshop") });
    expect(proxy(request("PATCH", "/api/orders/ORD-20260927-ABCD")).status).toBe(401);
    expect(proxy(request("POST", "/api/orders/ORD-20260927-ABCD")).status).toBe(401);
    expect(passes(proxy(request("POST", "/api/orders")))).toBe(true);
  });

  it("lets the workshop through with the bearer token or the sign-in cookie", () => {
    vi.stubEnv("WORKSHOP_TOKEN", "bench-key");
    expect(passes(proxy(request("GET", "/api/orders", { authorization: "Bearer bench-key" })))).toBe(true);
    expect(passes(proxy(request("GET", "/api/orders/ORD-20260927-ABCD", { cookie: "atelier_workshop=bench-key" })))).toBe(true);
    expect(proxy(request("GET", "/api/orders", { authorization: "Bearer wrong" })).status).toBe(401);
  });
});
