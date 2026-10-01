import { clientIp, json, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { markEnded } from "@/server/services/incidents";

export const POST = route(async (req: Request, ctx: RouteContext<"/api/incidents/[id]/ended">) => {
  const { id } = await ctx.params;
  const user = await requireUser(clientIp(req));
  const added = await markEnded(id, user);
  return json({ ok: true, added });
});
