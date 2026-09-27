import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_SPEC } from "@/domain/catalog";
import type { WatchSpec } from "@/domain/types";
import { specFromJson } from "./specCodec";

const STORAGE_KEY = "atelier.design";

function loadSavedSpec(): WatchSpec | null {
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    return json === null ? null : specFromJson(json);
  } catch {
    return null;
  }
}

function saveSpec(spec: WatchSpec): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(spec));
  } catch {
    // Private browsing or full storage: the design simply isn't remembered between visits.
  }
}

interface DesignStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): WatchSpec;
  getServerSnapshot(): WatchSpec;
  set(spec: WatchSpec): void;
}

/**
 * The design being edited, remembered in this browser. It lives outside React state so the saved
 * design can be read during render: the server (and hydration) use the shared design or the
 * default, then the client switches to the one saved in localStorage.
 */
function createDesignStore(shared: WatchSpec | null): DesignStore {
  const serverSpec = shared ?? DEFAULT_SPEC;
  let current = shared;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      current ??= loadSavedSpec() ?? DEFAULT_SPEC;
      return current;
    },
    getServerSnapshot() {
      return serverSpec;
    },
    set(spec) {
      current = spec;
      saveSpec(spec);
      for (const listener of listeners) listener();
    },
  };
}

/**
 * The configurator's design: a shared link wins, then the design saved in this browser, then the
 * default. Every change is saved. A shared design is saved on arrival and the `?d=` parameter
 * dropped from the address bar, so reloading keeps the customer's edits rather than the link.
 */
export function useDesign(shared: WatchSpec | null): [WatchSpec, (spec: WatchSpec) => void] {
  const [store] = useState(() => createDesignStore(shared));
  const spec = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    if (!shared) return;
    saveSpec(shared);
    window.history.replaceState(null, "", window.location.pathname);
  }, [shared]);

  return [spec, store.set];
}
