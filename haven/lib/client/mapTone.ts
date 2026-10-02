"use client";

import { useSyncExternalStore } from "react";

// The map screen decides its chrome tone (light panels over the day style).
// The tab bar lives outside the map, so it reads the tone from here.
export type Tone = "dark" | "light";

let tone: Tone = "dark";
const listeners = new Set<() => void>();

export function setMapTone(next: Tone) {
  if (next === tone) return;
  tone = next;
  listeners.forEach((l) => l());
}

export function useMapTone(): Tone {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => tone,
    () => "dark",
  );
}
