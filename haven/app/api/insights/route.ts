import { z } from "zod";
import { clientIp, json, parseQuery, rateLimit, route } from "@/server/http";
import { currentViewer } from "@/server/auth/session";
import { areaInsights } from "@/server/services/insights";

const q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMi: z.coerce.number().min(0.5).max(25).default(3),
});

export const GET = route(async (req: Request) => {
  rateLimit(`insights:${clientIp(req)}`, 60, 60_000);
  const { lat, lng, radiusMi } = parseQuery(req, q);
  const insights = await areaInsights({ lat, lng }, radiusMi, await currentViewer());
  return json({ insights });
});
