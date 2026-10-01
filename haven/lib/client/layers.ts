"use client";

import { useSyncExternalStore } from "react";

// Optional map layers, remembered on this device.
const KEY = "haven.layers.v1";
export interface LayerPrefs {
  cameras: boolean;
}
const DEFAULTS: LayerPrefs = { cameras: false };
let cached: LayerPrefs | null = null;
const listeners = new Set<() => void>();

function read(): LayerPrefs {
  if (cached) return cached;
  try {
    cached = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<LayerPrefs>) };
  } catch {
    cached = DEFAULTS;
  }
  return cached;
}

export function setLayerPrefs(patch: Partial<LayerPrefs>) {
  cached = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Storage blocked: lasts for this visit.
  }
  listeners.forEach((l) => l());
}

export function useLayerPrefs(): LayerPrefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULTS,
  );
}
