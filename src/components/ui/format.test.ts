import { describe, expect, it } from "vitest";
import { mailtoHref, vatNote } from "./format";

describe("mailtoHref", () => {
  it("links a plain address as it is", () => {
    expect(mailtoHref("ada@example.com")).toBe("mailto:ada@example.com");
    expect(mailtoHref("a+tag@example.com")).toBe("mailto:a%2Btag@example.com");
  });

  it("turns header fields smuggled into an address into part of the address", () => {
    const href = mailtoHref("victim@b.cc?cc=attacker%40evil.example&subject=Your%20order&body=Pay%20here");
    expect(href.startsWith("mailto:victim@b.cc%3Fcc%3D")).toBe(true);
    expect(href.slice("mailto:".length)).not.toMatch(/[?&#]/);
    expect(href.match(/@/g)).toHaveLength(1);
  });

  it("keeps an apostrophe readable to mail clients", () => {
    expect(decodeURIComponent(mailtoHref("o'brien@example.ie"))).toBe("mailto:o'brien@example.ie");
  });
});

describe("vatNote", () => {
  it("names the VAT rate included in a price", () => {
    expect(vatNote({ vatRatePct: 20 })).toBe("incl. 20% VAT");
    expect(vatNote({ vatRatePct: 5.5 })).toBe("incl. 5.5% VAT");
    expect(vatNote({ vatRatePct: 0 })).toBe("no VAT charged");
    // Orders quoted before VAT was itemised showed their price excluding VAT.
    expect(vatNote({ vatRatePct: 0, quotedExclVat: true })).toBe("excl. VAT");
  });
});
