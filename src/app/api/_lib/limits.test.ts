import { afterEach, describe, expect, it, vi } from "vitest";
import { clientKey, concurrencyLimit, dailyQuota, fixedWindowLimiter } from "./limits";

describe("fixedWindowLimiter", () => {
  it("allows `limit` requests per window per key, then says when to retry", () => {
    const limiter = fixedWindowLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.take("a", 0).ok).toBe(true);
    expect(limiter.take("a", 1_000).ok).toBe(true);
    expect(limiter.take("a", 2_000)).toEqual({ ok: false, retryAfterSeconds: 58 });
    expect(limiter.take("b", 2_000).ok).toBe(true);
    expect(limiter.take("a", 60_000).ok).toBe(true);
  });

  it("gives a refunded request back, once", () => {
    const limiter = fixedWindowLimiter({ limit: 1, windowMs: 60_000 });
    const first = limiter.take("a", 0);
    if (!first.ok) throw new Error("expected the first request through");
    first.refund();
    first.refund();
    expect(limiter.take("a", 1).ok).toBe(true);
    expect(limiter.take("a", 2).ok).toBe(false);
  });

  it("keeps working with a flood of distinct keys", () => {
    const limiter = fixedWindowLimiter({ limit: 1, windowMs: 60_000 });
    for (let i = 0; i < 20_000; i++) limiter.take(`key-${i}`, 0);
    expect(limiter.take("fresh", 0).ok).toBe(true);
  });
});

describe("concurrencyLimit", () => {
  it("hands out at most `max` slots and takes each release once", () => {
    const limit = concurrencyLimit(1);
    const release = limit.tryAcquire();
    expect(release).not.toBeNull();
    expect(limit.tryAcquire()).toBeNull();
    release?.();
    release?.();
    const again = limit.tryAcquire();
    expect(again).not.toBeNull();
    expect(limit.tryAcquire()).toBeNull();
  });
});

describe("dailyQuota", () => {
  it("counts per UTC day and is unlimited without a limit", () => {
    let max: number | undefined = 1;
    const quota = dailyQuota(() => max);
    expect(quota.tryTake(new Date("2026-09-27T10:00:00Z"))).toBe(true);
    expect(quota.tryTake(new Date("2026-09-27T23:59:00Z"))).toBe(false);
    expect(quota.tryTake(new Date("2026-09-28T00:01:00Z"))).toBe(true);
    max = undefined;
    expect(quota.tryTake(new Date("2026-09-28T00:02:00Z"))).toBe(true);
  });
});

describe("clientKey", () => {
  afterEach(() => vi.unstubAllEnvs());
  const request = (forwarded?: string) =>
    new Request("http://localhost", { headers: forwarded ? { "x-forwarded-for": forwarded } : {} });

  it("uses the whole forwarded header unless a trusted proxy appends the client address", () => {
    expect(clientKey(request("203.0.113.9, 10.0.0.1"))).toBe("203.0.113.9, 10.0.0.1");
    expect(clientKey(request())).toBe("unknown");
    vi.stubEnv("TRUST_PROXY", "1");
    expect(clientKey(request("spoofed, 203.0.113.9"))).toBe("203.0.113.9");
  });
});
