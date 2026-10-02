import { clientIp, json, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { markEnded } from "@/server/services/incidents";
import { ensureIngested } from "@/server/services/ingest";

export const POST = route(async (req: Request, ctx: RouteContext<"/api/incidents/[id]/ended">) => {
  const { id } = await ctx.params;
  await ensureIngested();
  const user = await requireUser(clientIp(req));
  const added = await markEnded(id, user);
  return json({ ok: true, added });
});
