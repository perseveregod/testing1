import { z } from "zod";
import { json, parseQuery, route } from "@/server/http";
import { currentViewer } from "@/server/auth/session";
import { getIncidentDetail } from "@/server/services/incidents";
import { ensureIngested } from "@/server/services/ingest";

const q = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const GET = route(async (req: Request, ctx: RouteContext<"/api/incidents/[id]">) => {
  const { id } = await ctx.params;
  await ensureIngested();
  const { lat, lng } = parseQuery(req, q);
  const from = lat != null && lng != null ? { lat, lng } : null;
  const incident = await getIncidentDetail(id, await currentViewer(), from);
  return json({ incident });
});
