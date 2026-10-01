import { z } from "zod";
import { boundingBox } from "@/lib/geo";
import { clientIp, json, parseQuery, rateLimit, route } from "@/server/http";
import { ALPR_ATTRIBUTION, alprCameras } from "@/server/sources/cameras";

const q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMi: z.coerce.number().min(1).max(60).default(25),
});

/** License plate reader cameras near a point (OpenStreetMap data). */
export const GET = route(async (req: Request) => {
  rateLimit(`cameras:${clientIp(req)}`, 60, 60_000);
  const { lat, lng, radiusMi } = parseQuery(req, q);
  const box = boundingBox({ lat, lng }, radiusMi * 1609.344);
  const { items, updatedAt } = await alprCameras();
  const cameras = items.filter((c) => c.lat >= box.minLat && c.lat <= box.maxLat && c.lng >= box.minLng && c.lng <= box.maxLng);
  return json(
    { cameras, total: items.length, updatedAt, attribution: ALPR_ATTRIBUTION },
    { headers: { "Cache-Control": "public, max-age=600" } },
  );
});
