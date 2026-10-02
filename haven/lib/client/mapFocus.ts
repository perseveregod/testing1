"use client";

import type { LatLng } from "@/lib/geo";

/**
 * One-shot hand-off for "show this spot on the map" from other tabs.
 * Kept in memory only (no URL, no storage), so nothing about the place
 * leaks into history or links. Survives client-side navigation.
 */
let pending: { point: LatLng; label: string } | null = null;

export function setMapFocus(point: LatLng, label: string) {
  pending = { point, label };
}

export function peekMapFocus() {
  return pending;
}

export function takeMapFocus() {
  const p = pending;
  pending = null;
  return p;
}
