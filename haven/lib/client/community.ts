"use client";

import useSWR from "swr";
import type { LatLng } from "@/lib/geo";
import type { CommunityEvent, CommunityEventDetail } from "@/lib/community";
import { fetcher } from "./api";

export function eventsUrl(center: LatLng | null, radiusMi = 25, days = 30): string | null {
  if (!center) return null;
  const q = new URLSearchParams({
    lat: center.lat.toFixed(2),
    lng: center.lng.toFixed(2),
    radiusMi: String(radiusMi),
    days: String(days),
  });
  return `/api/community/events?${q}`;
}

export function useCommunityEvents(center: LatLng | null, radiusMi = 25) {
  const { data, error, isLoading, mutate } = useSWR<{ events: CommunityEvent[] }>(eventsUrl(center, radiusMi), fetcher, {
    refreshInterval: 120_000,
    keepPreviousData: true,
  });
  return { events: data?.events ?? [], error, isLoading: isLoading && !data, mutate };
}

export function useCommunityEvent(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ event: CommunityEventDetail }>(
    id ? `/api/community/events/${encodeURIComponent(id)}` : null,
    fetcher,
    { refreshInterval: 30_000 },
  );
  return { event: data?.event ?? null, error, isLoading: isLoading && !data, mutate };
}

/** "Sat, Oct 4 · 11:00 AM" in the viewer's language. */
export function formatEventTime(startsAt: string, endsAt: string | null, lang: "en" | "es" = "en"): string {
  const locale = lang === "es" ? "es-US" : undefined;
  const s = new Date(startsAt);
  const day = s.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  return endsAt ? `${day} · ${t(s)} – ${t(new Date(endsAt))}` : `${day} · ${t(s)}`;
}

/** "Today", "Tomorrow", "This weekend", "Later" groupings for the board. */
export function eventBucket(startsAt: string, now = Date.now()): "now" | "today" | "tomorrow" | "week" | "later" {
  const s = new Date(startsAt);
  const n = new Date(now);
  if (s.getTime() <= now) return "now";
  const dayDiff = Math.round(
    (new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime() - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) /
      86_400_000,
  );
  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "tomorrow";
  if (dayDiff < 7) return "week";
  return "later";
}

export const BUCKET_LABEL = { now: "Happening now", today: "Today", tomorrow: "Tomorrow", week: "This week", later: "Coming up" } as const;
export const BUCKET_LABEL_ES = { now: "Pasando ahora", today: "Hoy", tomorrow: "Mañana", week: "Esta semana", later: "Próximamente" } as const;
