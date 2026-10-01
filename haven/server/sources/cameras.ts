import { config } from "../config";

// Automated license plate readers (Flock Safety and others) as mapped by
// volunteers in OpenStreetMap (the DeFlock project). Open data under ODbL;
// shown with attribution. One Overpass query per instance per day, which is
// well inside the public instance's fair-use policy.

export interface AlprCamera {
  id: string;
  lat: number;
  lng: number;
  operator: string | null;
  manufacturer: string | null;
  /** Compass direction the camera faces, in degrees, when mapped. */
  direction: number | null;
  /** What the mapper noted it covers (e.g. "northbound traffic"). */
  note: string | null;
}

export const ALPR_ATTRIBUTION = "© OpenStreetMap contributors (ODbL), via the DeFlock project";
export const OVERPASS_URL = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

// Greater Houston, generously.
export const HOUSTON_BBOX = { south: 29.35, west: -96.0, north: 30.25, east: -94.8 };

const QUERY = `[out:json][timeout:60];
(
  node["man_made"="surveillance"]["surveillance:type"="ALPR"](${HOUSTON_BBOX.south},${HOUSTON_BBOX.west},${HOUSTON_BBOX.north},${HOUSTON_BBOX.east});
  node["man_made"="surveillance"]["camera:type"="ALPR"](${HOUSTON_BBOX.south},${HOUSTON_BBOX.west},${HOUSTON_BBOX.north},${HOUSTON_BBOX.east});
);
out body;`;

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export function parseOverpass(body: { elements?: OverpassElement[] }): AlprCamera[] {
  const out: AlprCamera[] = [];
  for (const el of body.elements ?? []) {
    if (el.type !== "node" || typeof el.lat !== "number" || typeof el.lon !== "number") continue;
    const t = el.tags ?? {};
    const dirRaw = t["direction"] ?? t["camera:direction"];
    const dir = dirRaw != null ? Number(String(dirRaw).split(";")[0]) : NaN;
    out.push({
      id: `osm-${el.id}`,
      lat: el.lat,
      lng: el.lon,
      operator: t["operator"] ?? null,
      manufacturer: t["manufacturer"] ?? t["brand"] ?? null,
      direction: Number.isFinite(dir) ? ((dir % 360) + 360) % 360 : null,
      note: t["description"] ?? t["note"] ?? null,
    });
  }
  return out;
}

let cache: { at: number; items: AlprCamera[] } | null = null;
let inflight: Promise<AlprCamera[]> | null = null;
const DAY = 24 * 3_600_000;

/** Houston-area ALPR cameras, cached for a day; stale data beats no data. */
export async function alprCameras(): Promise<{ items: AlprCamera[]; updatedAt: string | null }> {
  if (cache && Date.now() - cache.at < DAY) return { items: cache.items, updatedAt: new Date(cache.at).toISOString() };
  if (!inflight) {
    inflight = (async () => {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": `Haven/0.1 community-safety-app${config.sources.contactEmail ? ` (${config.sources.contactEmail})` : ""}`,
        },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(70_000),
      });
      if (!res.ok) throw new Error(`overpass HTTP ${res.status}`);
      const items = parseOverpass((await res.json()) as { elements?: OverpassElement[] });
      cache = { at: Date.now(), items };
      return items;
    })().finally(() => {
      inflight = null;
    });
  }
  try {
    const items = await inflight;
    return { items, updatedAt: new Date(cache?.at ?? Date.now()).toISOString() };
  } catch (err) {
    console.warn("[haven] ALPR fetch failed", (err as Error).message);
    return { items: cache?.items ?? [], updatedAt: cache ? new Date(cache.at).toISOString() : null };
  }
}

/** Tests only. */
export function resetAlprCacheForTests() {
  cache = null;
  inflight = null;
}
