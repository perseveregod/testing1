import type { CategoryId, DataSource, IncidentStatus, Severity } from "@/lib/types";

// Every incident feed (city open data, weather, demo seed...) is an adapter
// that returns normalized incidents. The ingest service upserts them by
// (sourceId, externalId), so adding a city means adding one file here and
// listing it in registry.ts.

export interface NormalizedIncident {
  externalId: string;
  category: CategoryId;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  approximateAddress: string;
  severity: Severity;
  status: IncidentStatus;
  observedAt: string;
}

export interface SourceContext {
  now: Date;
  demoCenter: { lat: number; lng: number };
  userAgent: string;
  /** True when this source already stored an item with this id; lets adapters skip expensive work (geocoding) for it. */
  isKnown: (externalId: string) => Promise<boolean>;
}

/**
 * Adapters that can't produce every active item on each run (e.g. geocoding
 * a few new ones per run) return this shape: `activeExternalIds` is the full
 * active set, used to resolve items that have disappeared from the feed.
 */
export interface FetchResult {
  items: NormalizedIncident[];
  activeExternalIds: string[];
}

export interface SourceAdapter {
  meta: Omit<DataSource, "enabled" | "lastSyncedAt">;
  /**
   * When true, fetch() returns every currently-active item, so anything from
   * this source missing from the result has ended and gets resolved.
   */
  authoritativeActiveSet?: boolean;
  /** Demo data is regenerated relative to "now" rather than accumulating. */
  rolling?: boolean;
  /** Whether new items from this source should notify subscribers. */
  notify: boolean;
  fetch(ctx: SourceContext): Promise<NormalizedIncident[] | FetchResult>;
}

export async function fetchJson(url: string, ctx: SourceContext, timeoutMs = 8000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": ctx.userAgent },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}
