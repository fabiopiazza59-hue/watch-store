import { describe, expect, it } from "vitest";
import { dueDate, dueUrgency, inQueue, notesPreview, queueFilter } from "./queue";

const placed = { createdAt: "2026-09-01T10:00:00.000Z", quote: { leadTimeDays: 20 } };

describe("the workshop queue", () => {
  it("reads the tab from ?status=, defaulting to open orders", () => {
    expect(queueFilter("shipped")).toBe("shipped");
    expect(queueFilter("all")).toBe("all");
    expect(queueFilter(undefined)).toBe("open");
    expect(queueFilter(["open", "all"])).toBe("open");
    expect(queueFilter("../etc")).toBe("open");
  });

  it("files orders under their tab", () => {
    expect(inQueue("open", "assembling")).toBe(true);
    expect(inQueue("open", "shipped")).toBe(false);
    expect(inQueue("cancelled", "cancelled")).toBe(true);
    expect(inQueue("all", "cancelled")).toBe(true);
  });

  it("works out when an order is due and flags open ones that are close or late", () => {
    expect(dueDate(placed).toISOString()).toBe("2026-09-21T10:00:00.000Z");
    const order = (status: "received" | "shipped") => ({ ...placed, status });
    expect(dueUrgency(order("received"), new Date("2026-09-10T00:00:00Z"))).toBeNull();
    expect(dueUrgency(order("received"), new Date("2026-09-19T00:00:00Z"))).toBe("soon");
    expect(dueUrgency(order("received"), new Date("2026-09-22T00:00:00Z"))).toBe("overdue");
    expect(dueUrgency(order("shipped"), new Date("2026-09-22T00:00:00Z"))).toBeNull();
  });

  it("previews the first line of the notes", () => {
    expect(notesPreview("  Needed by 10 June!\nThanks")).toBe("Needed by 10 June!");
    expect(notesPreview("   ")).toBeNull();
  });
});
