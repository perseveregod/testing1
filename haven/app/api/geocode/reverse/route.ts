import { z } from "zod";
import { clientIp, json, parseQuery, rateLimit, route } from "@/server/http";
import { describeLocation } from "@/server/geocode";

const q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Street-level label for a point (never a house number). */
export const GET = route(async (req: Request) => {
  rateLimit(`rgeo:${clientIp(req)}`, 60, 60_000);
  const { lat, lng } = parseQuery(req, q);
  return json({ label: await describeLocation(lat, lng) });
});
