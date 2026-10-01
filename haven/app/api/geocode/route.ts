import { z } from "zod";
import { ApiError, clientIp, json, parseQuery, rateLimit, route } from "@/server/http";
import { searchPlaces } from "@/server/geocode";

const q = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const GET = route(async (req: Request) => {
  rateLimit(`geo:${clientIp(req)}`, 60, 60_000);
  const { q: query, lat, lng } = parseQuery(req, q);
  try {
    const results = await searchPlaces(query, lat != null && lng != null ? { lat, lng } : undefined);
    return json({ results });
  } catch {
    throw new ApiError(502, "Search is unavailable right now.", "geocoder_unavailable");
  }
});
