import { z } from "zod";
import { boundingBox } from "@/lib/geo";
import { clientIp, json, parseQuery, rateLimit, route } from "@/server/http";
import { after } from "next/server";
import { ALPR_ATTRIBUTION, alprCameras, alprCamerasCached } from "@/server/sources/cameras";

const q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMi: z.coerce.number().min(1).max(60).default(25),
});

// The first request after a cold start waits on Overpass; give it room.
export const maxDuration = 60;

/** License plate reader cameras near a point (OpenStreetMap data). */
export const GET = route(async (req: Request) => {
  rateLimit(`cameras:${clientIp(req)}`, 60, 60_000);
  const { lat, lng, radiusMi } = parseQuery(req, q);
  const box = boundingBox({ lat, lng }, radiusMi * 1609.344);
  // Answer at once with what this instance has; fetch or refresh after the
  // response goes out (Overpass can take 20 s+, longer than a phone will wait).
  const { items, updatedAt, fresh } = alprCamerasCached();
  if (!fresh) after(() => alprCameras().catch(() => undefined));
  const cameras = items.filter((c) => c.lat >= box.minLat && c.lat <= box.maxLat && c.lng >= box.minLng && c.lng <= box.maxLng);
  return json(
    { cameras, total: items.length, updatedAt, loading: updatedAt == null, attribution: ALPR_ATTRIBUTION },
    { headers: { "Cache-Control": updatedAt ? "public, max-age=600" : "no-store" } },
  );
});
