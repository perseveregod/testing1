// The student's chosen campus, remembered on this device only.

import { useSyncExternalStore } from "react";

const KEY = "haven.campus.v1";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCampusId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function setCampusId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
  listeners.forEach((l) => l());
}
