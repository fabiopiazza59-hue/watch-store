import { afterEach, describe, expect, it, vi } from "vitest";
import { isOrderConfirmationToken, isWorkshopRequest, isWorkshopToken, orderConfirmationToken } from "./workshopAuth";

afterEach(() => vi.unstubAllEnvs());

const headers = (values: Record<string, string>) => new Headers(values);

describe("the workshop gate", () => {
  it("is open while no WORKSHOP_TOKEN is set", () => {
    vi.stubEnv("WORKSHOP_TOKEN", "");
    expect(isWorkshopRequest(headers({}))).toBe(true);
    expect(isWorkshopToken("")).toBe(false);
  });

  it("accepts the token as a bearer or a cookie, and nothing else", () => {
    vi.stubEnv("WORKSHOP_TOKEN", "s3cret");
    expect(isWorkshopRequest(headers({ authorization: "Bearer s3cret" }))).toBe(true);
    expect(isWorkshopRequest(headers({ cookie: "a=b; atelier_workshop=s3cret" }))).toBe(true);
    expect(isWorkshopRequest(headers({}))).toBe(false);
    expect(isWorkshopRequest(headers({ authorization: "Bearer s3cre" }))).toBe(false);
    expect(isWorkshopRequest(headers({ cookie: "atelier_workshop=s3cret-and-more" }))).toBe(false);
    expect(isWorkshopRequest(headers({ cookie: "xatelier_workshop=s3cret" }))).toBe(false);
    expect(isWorkshopRequest(headers({ cookie: "atelier_workshop=%E0%A4%A" }))).toBe(false);
  });
});

describe("order confirmation links", () => {
  it("sign each order id with the link secret, falling back to the workshop token", () => {
    vi.stubEnv("ORDER_LINK_SECRET", "");
    vi.stubEnv("WORKSHOP_TOKEN", "s3cret");
    const token = orderConfirmationToken("ORD-20260927-ABCD");
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(isOrderConfirmationToken("ORD-20260927-ABCD", token)).toBe(true);
    expect(isOrderConfirmationToken("ORD-20260927-ABCE", token)).toBe(false);
    expect(isOrderConfirmationToken("ORD-20260927-ABCD", undefined)).toBe(false);

    vi.stubEnv("ORDER_LINK_SECRET", "other");
    expect(isOrderConfirmationToken("ORD-20260927-ABCD", token)).toBe(false);
  });

  it("need no token while no secret is configured", () => {
    vi.stubEnv("ORDER_LINK_SECRET", "");
    vi.stubEnv("WORKSHOP_TOKEN", "");
    expect(orderConfirmationToken("ORD-20260927-ABCD")).toBeNull();
    expect(isOrderConfirmationToken("ORD-20260927-ABCD", undefined)).toBe(true);
  });
});
