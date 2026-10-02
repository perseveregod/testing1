import { approximate } from "@/lib/geo";
import { config } from "./config";

// Place search and reverse geocoding through a Nominatim-compatible API.
// Results are cached and requests are serialized to respect the public
// server's 1 request/second policy. For production traffic point GEOCODER_URL
// at a self-hosted or commercial provider.

export interface GeocodeResult {
  id: string;
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
}

const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 24 * 3_600_000;
let queue: Promise<unknown> = Promise.resolve();

function userAgent() {
  const contact = config.sources.contactEmail ? ` (${config.sources.contactEmail})` : "";
  return `Haven/0.1 community-safety-app${contact}`;
}

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => new Promise((r) => setTimeout(r, 1000)),
    () => new Promise((r) => setTimeout(r, 1000)),
  );
  return run;
}

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 5000) cache.delete(cache.keys().next().value!);
  return value;
}

interface NominatimItem {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: Record<string, string>;
}

function shortName(item: NominatimItem) {
  const a = item.address ?? {};
  const primary = item.name || a.road || a.neighbourhood || a.suburb || item.display_name.split(",")[0]!;
  const parts = [a.neighbourhood || a.suburb, a.city || a.town || a.village, a.state].filter(
    (p): p is string => Boolean(p) && p !== primary,
  );
  return { name: primary, detail: parts.slice(0, 2).join(", ") };
}

export async function searchPlaces(q: string, near?: { lat: number; lng: number }): Promise<GeocodeResult[]> {
  if (config.geocoder.disabled) return [];
  const query = q.trim().slice(0, 120);
  if (query.length < 2) return [];
  const bias = near ? approximate(near, 1) : null;
  const key = `s:${query.toLowerCase()}:${bias ? `${bias.lat},${bias.lng}` : ""}`;
  return cached(key, () =>
    throttled(async () => {
      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        addressdetails: "1",
        limit: "6",
      });
      if (bias) {
        const d = 0.6;
        params.set("viewbox", `${bias.lng - d},${bias.lat + d},${bias.lng + d},${bias.lat - d}`);
      }
      const res = await fetch(`${config.geocoder.url}/search?${params}`, {
        headers: { "User-Agent": userAgent(), "Accept-Language": "en" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`geocoder HTTP ${res.status}`);
      const items = (await res.json()) as NominatimItem[];
      return items.map((it) => ({
        id: String(it.place_id),
        ...shortName(it),
        latitude: Number(it.lat),
        longitude: Number(it.lon),
      }));
    }),
  );
}

let censusQueue: Promise<unknown> = Promise.resolve();
const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

/**
 * US Census Bureau geocoder: free, no key, handles house numbers and
 * intersections ("Main St & 5th Ave, Houston, TX") and returns nothing for a
 * bare street name, which keeps imprecise points off the map. Misses are
 * cached too, so a feed row that can't be placed isn't retried every run.
 */
export async function geocodeCensus(address: string): Promise<{ lat: number; lng: number } | null> {
  if (config.geocoder.disabled) return null;
  const key = `c:${address.toLowerCase().replace(/\s+/g, " ").trim()}`;
  return cached(key, () => {
    const run = censusQueue.then(
      async () => {
        const params = new URLSearchParams({ address, benchmark: "Public_AR_Current", format: "json" });
        const res = await fetch(`${CENSUS_URL}?${params}`, {
          headers: { "User-Agent": userAgent(), Accept: "application/json" },
          signal: AbortSignal.timeout(9000),
        });
        if (!res.ok) throw new Error(`census geocoder HTTP ${res.status}`);
        const body = (await res.json()) as { result?: { addressMatches?: { coordinates?: { x: number; y: number } }[] } };
        const c = body.result?.addressMatches?.[0]?.coordinates;
        return c && Number.isFinite(c.x) && Number.isFinite(c.y) ? { lat: c.y, lng: c.x } : null;
      },
      () => null,
    );
    // Be polite: a short gap between requests even though no limit is published.
    censusQueue = run.then(
      () => new Promise((r) => setTimeout(r, 250)),
      () => new Promise((r) => setTimeout(r, 250)),
    );
    return run;
  });
}

/**
 * A street-level description of a point, never including a house number,
 * e.g. "Pike St, Downtown". Falls back to "" so callers can choose wording.
 */
export async function describeLocation(lat: number, lng: number): Promise<string> {
  if (config.geocoder.disabled) return "";
  const p = approximate({ lat, lng }, 3);
  try {
    return await cached(`r:${p.lat},${p.lng}`, () =>
      throttled(async () => {
        const params = new URLSearchParams({
          lat: String(p.lat),
          lon: String(p.lng),
          format: "jsonv2",
          zoom: "17",
          addressdetails: "1",
        });
        const res = await fetch(`${config.geocoder.url}/reverse?${params}`, {
          headers: { "User-Agent": userAgent(), "Accept-Language": "en" },
          signal: AbortSignal.timeout(3500),
        });
        if (!res.ok) return "";
        const it = (await res.json()) as { address?: Record<string, string> };
        const a = it.address ?? {};
        const street = a.road || a.pedestrian || a.footway;
        const area = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.city || a.town;
        return [street, area].filter(Boolean).join(", ");
      }),
    );
  } catch {
    return "";
  }
}
