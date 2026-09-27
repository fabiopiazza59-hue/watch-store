// What the watchmaker has ticked off on a build sheet, kept in this browser so a reload, a sleeping
// tablet or a trip to another page doesn't lose a bench session's progress. A useSyncExternalStore
// store: the server and hydration render nothing ticked, then the browser's saved ticks appear.
import { useSyncExternalStore } from "react";

const NONE: ReadonlySet<string> = new Set();
const cache = new Map<string, ReadonlySet<string>>();
const listeners = new Map<string, Set<() => void>>();

export type BenchList = "tools" | "steps" | "qc";

/** localStorage keys for one order's lists: `atelier.bench.<orderId>.<list>`. */
export function benchStorageKey(orderId: string, list: BenchList): string {
  return `atelier.bench.${orderId}.${list}`;
}

function load(key: string): ReadonlySet<string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === "string")) : NONE;
  } catch {
    return NONE;
  }
}

function read(key: string): ReadonlySet<string> {
  let ticks = cache.get(key);
  if (!ticks) {
    ticks = load(key);
    cache.set(key, ticks);
  }
  return ticks;
}

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

/** Ticks or unticks `id` in the list stored under `key`. */
export function toggleTick(key: string, id: string): void {
  const next = new Set(read(key));
  if (next.has(id)) next.delete(id);
  else next.add(id);
  cache.set(key, next);
  try {
    window.localStorage.setItem(key, JSON.stringify([...next]));
  } catch {
    // Private browsing or full storage: the ticks last as long as this page does.
  }
  notify(key);
}

function subscribe(key: string, listener: () => void): () => void {
  const forKey = listeners.get(key) ?? new Set();
  listeners.set(key, forKey);
  forKey.add(listener);
  // Another tab ticking the same sheet.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    cache.delete(key);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    forKey.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The ids ticked in the list stored under `key`. */
export function useTicks(key: string): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => read(key),
    () => NONE,
  );
}
