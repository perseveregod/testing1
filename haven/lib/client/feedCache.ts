"use client";

// The last "near you" answer, kept on this device so the app opens with
// incidents on screen instead of a spinner, then refreshes. Only the base
// near-you query is stored (one entry); filtered views are cut from it.

import { useSyncExternalStore } from "react";
import { distanceMiles, type LatLng } from "@/lib/geo";
import { NEAR_LIMIT, NEAR_RADIUS_MI, type IncidentParams, type IncidentsResponse } from "./hooks";

const KEY = "haven.feed.v1";
const MAX_AGE_MS = 12 * 3_600_000;
/** A stored answer still stands in for a query centered this close. */
const MAX_DRIFT_MI = 0.6;

interface Entry {
  center: LatLng;
  radiusMi: number;
  shape: string;
  at: number;
  data: IncidentsResponse;
}

let cached: Entry | null | undefined;
const listeners = new Set<() => void>();
const results = new Map<string, IncidentsResponse | undefined>();

/** Everything about a query except where it's centered and which categories. */
function shapeOf(p: IncidentParams): string {
  return [p.sort ?? "newest", p.limit ?? 200, p.sinceHours ?? "", p.minSeverity ?? "", p.verifiedOnly ? 1 : 0, p.includeResolved === false ? 0 : 1].join("|");
}

function load(): Entry | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    const e = raw ? (JSON.parse(raw) as Entry) : null;
    cached = e && e.center && e.data && Array.isArray(e.data.items) ? e : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function readFeedCache(p: IncidentParams, now = Date.now()): IncidentsResponse | undefined {
  if (!p.center) return undefined;
  const e = load();
  if (!e || now - e.at > MAX_AGE_MS) return undefined;
  if (e.radiusMi !== p.radiusMi || e.shape !== shapeOf(p)) return undefined;
  if (distanceMiles(e.center, p.center) > MAX_DRIFT_MI) return undefined;
  const cats = p.categories?.length ? new Set(p.categories) : null;
  if (!cats) return e.data;
  return { ...e.data, items: e.data.items.filter((i) => cats.has(i.category)) };
}

/** Only the shared "near you" query (Map count, Feed, Safety) is remembered. */
function isNearYou(p: IncidentParams): boolean {
  return (
    p.radiusMi === NEAR_RADIUS_MI &&
    (p.limit ?? 200) === NEAR_LIMIT &&
    (p.sort ?? "newest") === "newest" &&
    !p.categories?.length &&
    !p.sinceHours &&
    !p.minSeverity &&
    !p.verifiedOnly &&
    p.includeResolved !== false
  );
}

export function writeFeedCache(p: IncidentParams, data: IncidentsResponse, now = Date.now()) {
  if (!p.center || !isNearYou(p)) return;
  cached = { center: p.center, radiusMi: p.radiusMi, shape: shapeOf(p), at: now, data };
  results.clear();
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Storage full or blocked: the next open starts from the network.
  }
  listeners.forEach((l) => l());
}

/** Tests only: forget what's in memory (storage is the test's to clear). */
export function resetFeedCacheForTests() {
  cached = undefined;
  results.clear();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * The stored answer for `p` (undefined when none fits). Null on the server
 * and during hydration, so the first client render can fill in instantly
 * without a markup mismatch.
 */
export function useFeedCache(p: IncidentParams, key: string | null): IncidentsResponse | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!key) return undefined;
      // Stable per key, as getSnapshot must be.
      if (!results.has(key)) results.set(key, readFeedCache(p));
      return results.get(key);
    },
    () => undefined,
  );
}
