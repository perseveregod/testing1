"use client";

// One-time tips ("Tap a pin to see what's happening"), remembered on this
// device. Read with useSyncExternalStore; the server renders no tips.

import { useSyncExternalStore } from "react";

const KEY = "haven.tips.v1";
const listeners = new Set<() => void>();
let cached: Set<string> | null = null;

function read(): Set<string> {
  if (cached) return cached;
  try {
    cached = new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    cached = new Set();
  }
  return cached;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** True while `id` has not been dismissed on this device (always false on the server). */
export function useTip(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !read().has(id),
    () => false,
  );
}

export function dismissTip(id: string) {
  const next = new Set(read());
  next.add(id);
  cached = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // Storage blocked: the tip stays dismissed for this visit.
  }
  listeners.forEach((l) => l());
}
