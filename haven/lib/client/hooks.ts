"use client";

import { useSyncExternalStore } from "react";
import useSWR from "swr";
import { distanceMiles, type LatLng } from "@/lib/geo";
import type { AlertPreferences, DataSource, NotificationItem, PricingInfo, PublicIncident, SavedPlace, Viewer } from "@/lib/types";
import { fetcher } from "./api";
import { useFeedCache, writeFeedCache } from "./feedCache";

export function useViewer() {
  const { data, error, isLoading, mutate } = useSWR<{ viewer: Viewer }>("/api/me", fetcher, {
    revalidateOnFocus: true,
  });
  return { viewer: data?.viewer ?? null, error, isLoading, mutate };
}

/** Per-user endpoints wait until /api/me has established the session cookie. */
function useSessionKey(url: string): string | null {
  const { viewer } = useViewer();
  return viewer ? url : null;
}

export function usePlaces(enabled = true) {
  const key = useSessionKey("/api/places");
  const { data, error, isLoading, mutate } = useSWR<{ places: SavedPlace[]; max: number }>(enabled ? key : null, fetcher);
  return { places: data?.places ?? [], max: data?.max ?? 1, error, isLoading, mutate };
}

export function useAlertPrefs() {
  const { data, error, isLoading, mutate } = useSWR<{ prefs: AlertPreferences }>(
    useSessionKey("/api/alerts/preferences"),
    fetcher,
  );
  return { prefs: data?.prefs ?? null, error, isLoading, mutate };
}

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<{ items: NotificationItem[]; unread: number }>(
    useSessionKey("/api/notifications"),
    fetcher,
    { refreshInterval: 45_000 },
  );
  return { items: data?.items ?? [], unread: data?.unread ?? 0, loaded: Boolean(data), error, isLoading, mutate };
}

/**
 * When the official feeds were last checked, so people can judge how fresh
 * the map is. Null until known, or when no live feed is on. `stale` compares
 * against the caller's clock (a ticking `now`), never Date.now() in render.
 */
export function useFeedFreshness(now: number): { checkedAt: number | null; stale: boolean } {
  const { data } = useSWR<{ sources: DataSource[] }>("/api/sources", fetcher, { refreshInterval: 30_000, revalidateOnFocus: true });
  const live = (data?.sources ?? []).filter((s) => s.enabled && s.kind !== "demo" && s.kind !== "user" && s.lastSyncedAt);
  if (live.length === 0) return { checkedAt: null, stale: false };
  const checkedAt = Math.max(...live.map((s) => new Date(s.lastSyncedAt!).getTime()));
  return { checkedAt, stale: now > 0 && now - checkedAt > 20 * 60_000 };
}

export function usePricing() {
  // Price depends on who's signed in (a .edu email gets the student price),
  // so refetch when the account or its email changes. No email in the URL.
  const { viewer } = useViewer();
  const key: [string, string] = ["/api/billing/pricing", `${viewer?.id ?? ""}:${viewer?.email ? "verified" : "guest"}:${viewer?.email?.length ?? 0}`];
  const { data, error } = useSWR<{ pricing: PricingInfo }>(key, ([url]: [string, string]) => fetcher(url), {
    revalidateOnFocus: false,
  });
  return { pricing: data?.pricing ?? null, error };
}

export interface IncidentParams {
  center: LatLng | null;
  radiusMi: number;
  categories?: string[];
  sinceHours?: number;
  minSeverity?: string;
  verifiedOnly?: boolean;
  includeResolved?: boolean;
  sort?: "distance" | "newest";
  limit?: number;
}

export function incidentsUrl(p: IncidentParams): string | null {
  if (!p.center) return null;
  const q = new URLSearchParams({
    // ~100 m rounding keeps URLs cacheable and avoids sending exact positions.
    lat: p.center.lat.toFixed(3),
    lng: p.center.lng.toFixed(3),
    radiusMi: String(Math.round(p.radiusMi * 10) / 10),
    sort: p.sort ?? "newest",
    limit: String(p.limit ?? 200),
  });
  if (p.categories?.length) q.set("categories", p.categories.join(","));
  if (p.sinceHours) q.set("sinceHours", String(p.sinceHours));
  if (p.minSeverity) q.set("minSeverity", p.minSeverity);
  if (p.verifiedOnly) q.set("verifiedOnly", "1");
  if (p.includeResolved === false) q.set("includeResolved", "0");
  return `/api/incidents?${q}`;
}

export interface IncidentsResponse {
  items: PublicIncident[];
  sinceHours: number;
  historyLimited: boolean;
}

export interface InitialIncidents {
  /** The SWR key the client will ask for first; matches `incidentsUrl`. */
  key: string;
  data: IncidentsResponse;
}

const NO_ITEMS: PublicIncident[] = [];

const noop = () => () => {};
/** False while hydrating (what the server rendered), true after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * Incidents for a query. Polls every 30 s while the tab is visible (a poll
 * whose answer hasn't changed costs a 304 and nothing else), again on focus
 * and reconnect. The first paint comes from `initial` (server-fetched for
 * that exact key) or from the last answer kept on this device.
 */
export function useIncidents(p: IncidentParams, initial?: InitialIncidents | null) {
  const url = incidentsUrl(p);
  const remembered = useFeedCache(p, url);
  const hydrated = useHydrated();
  const { data, error, isLoading, isValidating, mutate } = useSWR<IncidentsResponse>(url, fetcher, {
    refreshInterval: 30_000,
    focusThrottleInterval: 5_000,
    keepPreviousData: true,
    fallbackData: initial && initial.key === url ? initial.data : remembered,
    onSuccess: (d) => writeFeedCache(p, d),
  });
  // Hydration counts as loading: the device copy fills in right after it.
  return { data, items: data?.items ?? NO_ITEMS, error, isLoading: !data && (isLoading || !hydrated), isValidating, mutate };
}

/** Distance from the person (not the query center), when we know where they are. */
export function distanceFrom(user: LatLng | null, i: { latitude: number; longitude: number }): number | null {
  return user ? distanceMiles(user, { lat: i.latitude, lng: i.longitude }) : null;
}

/**
 * "Near you" is one query everywhere (Map count, Feed, Safety): the same
 * radius, window and cap, so every tab shows the same number.
 */
export const NEAR_RADIUS_MI = 5;
export const NEAR_LIMIT = 200;

export function nearYouParams(center: LatLng | null, extra: Partial<IncidentParams> = {}): IncidentParams {
  return { center, radiusMi: NEAR_RADIUS_MI, sort: "newest", limit: NEAR_LIMIT, ...extra };
}

export function useNearYou(center: LatLng | null, initial?: InitialIncidents | null) {
  const r = useIncidents(nearYouParams(center), initial);
  const active = r.items.filter((i) => i.status !== "resolved");
  return { ...r, active, activeCount: active.length, label: activeLabel(active.length) };
}

/** "18 active · 5 mi" — the one wording for the shared count. */
export function activeLabel(n: number, radiusMi = NEAR_RADIUS_MI, es = false): string {
  return es ? `${n} activos · ${radiusMi} mi` : `${n} active · ${radiusMi} mi`;
}
