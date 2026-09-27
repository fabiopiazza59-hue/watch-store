import { describe, expect, it } from "vitest";
import { confirmationHref } from "./links";

describe("confirmationHref", () => {
  it("links to the customer's confirmation page, never the workshop's order page", () => {
    expect(confirmationHref("ORD-20260927-0123456789ABCDEF", "tok_en-1")).toBe(
      "/order-placed/ORD-20260927-0123456789ABCDEF?t=tok_en-1",
    );
    expect(confirmationHref("ORD-20260927-ABCD", null)).toBe("/order-placed/ORD-20260927-ABCD");
  });
});
