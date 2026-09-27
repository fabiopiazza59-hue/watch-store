import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in for next/headers: the request's headers, and a cookie store actions can write to. */
const request = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: new Map<string, { value: string; options?: unknown }>(),
}));

vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    set: (name: string, value: string, options?: unknown) => request.cookies.set(name, { value, options }),
    delete: (name: string) => request.cookies.delete(name),
    toString: () => [...request.cookies].map(([name, { value }]) => `${name}=${encodeURIComponent(value)}`).join("; "),
  }),
}));

const { signInToWorkshop, signOutOfWorkshop } = await import("./actions");
const { canSeeWorkshop } = await import("./workshopGate");

function form(key: string): FormData {
  const data = new FormData();
  data.set("key", key);
  return data;
}

describe("workshop sign-in", () => {
  beforeEach(() => {
    vi.stubEnv("WORKSHOP_TOKEN", "bench-secret");
    request.cookies.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("keeps a correct key in an http-only cookie, which the gate then accepts at once", async () => {
    request.headers = new Headers({ "x-forwarded-for": "198.51.100.10" });
    expect(await canSeeWorkshop()).toBe(false);
    expect(await signInToWorkshop({ error: null }, form("bench-secret"))).toEqual({ error: null });
    expect(request.cookies.get("atelier_workshop")).toMatchObject({ value: "bench-secret", options: { httpOnly: true } });
    expect(await canSeeWorkshop()).toBe(true);

    await signOutOfWorkshop();
    expect(await canSeeWorkshop()).toBe(false);
  });

  it("refuses a wrong key without setting anything", async () => {
    request.headers = new Headers({ "x-forwarded-for": "198.51.100.11" });
    expect(await signInToWorkshop({ error: null }, form("guess"))).toEqual({ error: "That isn't the workshop key." });
    expect(request.cookies.size).toBe(0);
  });

  it("slows down guessing: ten wrong keys, then even the right one waits", async () => {
    request.headers = new Headers({ "x-forwarded-for": "198.51.100.12" });
    for (let attempt = 0; attempt < 10; attempt++) await signInToWorkshop({ error: null }, form(`guess-${attempt}`));
    const blocked = await signInToWorkshop({ error: null }, form("bench-secret"));
    expect(blocked.error).toMatch(/Too many wrong keys/);
    expect(request.cookies.size).toBe(0);
  });
});
