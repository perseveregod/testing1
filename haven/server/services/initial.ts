import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { listQuerySchema } from "@/lib/validation";
import type { InitialIncidents } from "@/lib/client/hooks";
import { listIncidents } from "./incidents";
import { ensureIngested } from "./ingest";

/**
 * Incidents around the default area, fetched on the server so the first paint
 * already shows them. Mirrors the client's first query exactly so SWR treats
 * it as that key's fallback.
 */
export async function initialIncidents(radiusMi: number, limit: number, sort: "newest" | "distance" = "newest"): Promise<InitialIncidents | null> {
  try {
    await ensureIngested();
    const q = listQuerySchema.parse({
      lat: DEFAULT_CENTER.lat.toFixed(3),
      lng: DEFAULT_CENTER.lng.toFixed(3),
      radiusMi: String(radiusMi),
      sort,
      limit: String(limit),
    });
    const data = await listIncidents(q, null);
    const key = `/api/incidents?${new URLSearchParams({
      lat: DEFAULT_CENTER.lat.toFixed(3),
      lng: DEFAULT_CENTER.lng.toFixed(3),
      radiusMi: String(radiusMi),
      sort,
      limit: String(limit),
    })}`;
    return { key, data: { items: data.items, sinceHours: data.sinceHours, historyLimited: data.historyLimited } };
  } catch (err) {
    console.warn("[haven] initial incidents failed", err);
    return null;
  }
}
