import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC } from "@/domain/catalog";
import { designerStatus, designWatch, type DesignOptions } from "@/domain/designer";
import type { DesignResponse } from "@/domain/types";
import { POST } from "./route";

// The designer has its own tests; here it stands in for a (slow, costly) Claude conversation.
vi.mock("@/domain/designer", () => ({
  designerStatus: vi.fn(() => ({ mode: "claude", model: "claude-opus-5" })),
  designWatch: vi.fn(),
}));

const RESPONSE = { mode: "claude", spec: DEFAULT_SPEC, reply: "Here you go." } as DesignResponse;

function designRequest(client: string, init: { signal?: AbortSignal } = {}): Request {
  return new Request("http://localhost/api/design", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": client },
    body: JSON.stringify({ message: "a blue diver" }),
    signal: init.signal,
  });
}

beforeEach(() => {
  vi.mocked(designWatch).mockReset().mockResolvedValue(RESPONSE);
  vi.mocked(designerStatus).mockReturnValue({ mode: "claude", model: "claude-opus-5" });
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/design with the Claude designer", () => {
  it("passes the request's abort signal to the designer", async () => {
    const response = await POST(designRequest("10.0.0.1"));
    expect(response.status).toBe(200);
    const [, options] = vi.mocked(designWatch).mock.calls[0];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.claude).toBe(true);
  });

  it("limits each client to 20 messages per 10 minutes", async () => {
    for (let i = 0; i < 20; i++) expect((await POST(designRequest("10.0.0.2"))).status).toBe(200);
    const limited = await POST(designRequest("10.0.0.2"));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(500);
    expect((await POST(designRequest("10.0.0.3"))).status).toBe(200);
  });

  it("turns requests away with a 503 while four conversations are running, instead of queueing them", async () => {
    let finish: () => void = () => {};
    const running = new Promise<void>((resolve) => (finish = resolve));
    vi.mocked(designWatch).mockImplementation(async () => {
      await running;
      return RESPONSE;
    });
    const slow = [1, 2, 3, 4].map((i) => POST(designRequest(`10.0.1.${i}`)));
    await vi.waitFor(() => expect(designWatch).toHaveBeenCalledTimes(4));

    const busy = await POST(designRequest("10.0.1.5"));
    expect(busy.status).toBe(503);
    expect(busy.headers.get("retry-after")).toBe("30");

    finish();
    expect((await Promise.all(slow)).map((response) => response.status)).toEqual([200, 200, 200, 200]);
    expect((await POST(designRequest("10.0.1.5"))).status).toBe(200);
  });

  it("hands over to the offline designer once DESIGN_DAILY_LIMIT conversations have run today", async () => {
    vi.stubEnv("DESIGN_DAILY_LIMIT", "1");
    await POST(designRequest("10.0.2.1"));
    await POST(designRequest("10.0.2.2"));
    const flags = vi.mocked(designWatch).mock.calls.map(([, options]) => (options as DesignOptions).claude);
    expect(flags).toEqual([true, false]);
  });

  it("applies no limits while the cheap offline designer answers", async () => {
    vi.mocked(designerStatus).mockReturnValue({ mode: "offline", model: null });
    for (let i = 0; i < 25; i++) expect((await POST(designRequest("10.0.3.1"))).status).toBe(200);
  });
});
