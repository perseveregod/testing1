import { COOLING_CENTERS } from "@/lib/stormPrep";
import { geocodeCensus } from "@/server/geocode";
import { json, route } from "@/server/http";

// Cooling / warming centers with coordinates. The addresses are fixed, so
// they're geocoded once per instance (the Census geocoder, free) and cached.
let cache: { at: number; items: Located[] } | null = null;

interface Located {
  id: string;
  name: string;
  address: string;
  zip: string;
  lat: number | null;
  lng: number | null;
}

export const GET = route(async () => {
  if (!cache || Date.now() - cache.at > 24 * 3_600_000) {
    const items: Located[] = [];
    for (const c of COOLING_CENTERS) {
      const p = await geocodeCensus(`${c.address}, Houston, TX ${c.zip}`);
      items.push({ ...c, lat: p?.lat ?? null, lng: p?.lng ?? null });
    }
    cache = { at: Date.now(), items };
  }
  return json({ centers: cache.items }, { headers: { "Cache-Control": "public, max-age=3600" } });
});
