// In-memory abuse limits for the API: per-client request windows and a cap on concurrent work.
// State lives in this process, which suits the single-instance prototype; several instances would
// each apply their own limits.
import { jsonError } from "./http";

export type LimitResult =
  | {
      ok: true;
      /** Gives the request back, for one that turned out to be the customer's honest mistake. */
      refund(): void;
    }
  | { ok: false; retryAfterSeconds: number };

export interface RateLimiter {
  take(key: string, now?: number): LimitResult;
}

/** Past this many tracked clients, expired windows are dropped, and if that isn't enough, all of them. */
const MAX_TRACKED_KEYS = 10_000;

/** At most `limit` requests per client in each window of `windowMs`, counted from its first request. */
export function fixedWindowLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  function prune(now: number) {
    for (const [key, window] of windows) if (window.resetAt <= now) windows.delete(key);
    if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
  }

  return {
    take(key, now = Date.now()) {
      let window = windows.get(key);
      if (!window || window.resetAt <= now) {
        if (!window && windows.size >= MAX_TRACKED_KEYS) prune(now);
        window = { count: 0, resetAt: now + windowMs };
        windows.set(key, window);
      }
      if (window.count >= limit) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)) };
      }
      window.count++;
      const counted = window;
      let refunded = false;
      return {
        ok: true,
        refund() {
          if (refunded) return;
          refunded = true;
          counted.count = Math.max(0, counted.count - 1);
        },
      };
    },
  };
}

export interface ConcurrencyLimit {
  /** A release function when a slot is free, or null when `max` requests are already running. */
  tryAcquire(): (() => void) | null;
}

/** Caps how many requests run at once; callers turn extra ones away rather than queue them. */
export function concurrencyLimit(max: number): ConcurrencyLimit {
  let inFlight = 0;
  return {
    tryAcquire() {
      if (inFlight >= max) return null;
      inFlight++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        inFlight--;
      };
    },
  };
}

/** A global count per UTC day, e.g. for a spend cap. `limit()` is read on every call. */
export function dailyQuota(limit: () => number | undefined) {
  let day = "";
  let used = 0;
  return {
    tryTake(now = new Date()): boolean {
      const max = limit();
      if (max === undefined) return true;
      const today = now.toISOString().slice(0, 10);
      if (today !== day) [day, used] = [today, 0];
      if (used >= max) return false;
      used++;
      return true;
    },
  };
}

/** A positive whole number from the environment, or undefined when unset or not a number. */
export function envLimit(name: string): number | undefined {
  const value = Number(process.env[name]?.trim() || NaN);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/**
 * Who is asking, as far as the server can tell. Next fills `x-forwarded-for` with the socket's
 * address only when the client sent none, so it can't be trusted on its own. Behind a reverse proxy
 * that appends the client address (set TRUST_PROXY), the right-most entry is the one that proxy
 * saw. Without one, the whole header is the key: a client that invents its own header can dodge a
 * per-client limit, which is why the concurrency and daily caps sit behind it.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  if (process.env.TRUST_PROXY?.trim()) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    return hops.at(-1) ?? "unknown";
  }
  return forwarded.trim() || "unknown";
}

export function tooManyRequests(retryAfterSeconds: number, message: string): Response {
  return jsonError(429, message, {}, { "Retry-After": String(retryAfterSeconds) });
}
