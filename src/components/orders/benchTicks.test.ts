import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { benchStorageKey, toggleTick } from "./benchTicks";

/** A stand-in for the browser's localStorage, as vitest runs in Node. */
function fakeStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

describe("bench ticks", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal("window", { localStorage: storage, addEventListener() {}, removeEventListener() {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keys each order's lists apart", () => {
    expect(benchStorageKey("ORD-20260927-ABCD", "steps")).toBe("atelier.bench.ORD-20260927-ABCD.steps");
    expect(benchStorageKey("ORD-20260927-ABCD", "qc")).not.toBe(benchStorageKey("ORD-20260927-ABCE", "qc"));
  });

  it("saves every tick, so a reload finds them", () => {
    const key = benchStorageKey("ORD-20260927-0001", "tools");
    toggleTick(key, "tool-0");
    toggleTick(key, "tool-3");
    toggleTick(key, "tool-0");
    expect(JSON.parse(storage.getItem(key) ?? "null")).toEqual(["tool-3"]);
  });

  it("keeps working when storage refuses writes", () => {
    const key = benchStorageKey("ORD-20260927-0002", "qc");
    storage.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    expect(() => toggleTick(key, "timekeeping")).not.toThrow();
  });
});
