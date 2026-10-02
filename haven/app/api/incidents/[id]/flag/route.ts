import { flagSchema } from "@/lib/validation";
import { clientIp, json, parseBody, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { flagIncident } from "@/server/services/incidents";
import { ensureIngested } from "@/server/services/ingest";

export const POST = route(async (req: Request, ctx: RouteContext<"/api/incidents/[id]/flag">) => {
  const { id } = await ctx.params;
  await ensureIngested();
  const user = await requireUser(clientIp(req));
  const { reason } = await parseBody(req, flagSchema);
  const added = await flagIncident(id, user, reason);
  return json({ ok: true, added });
});
