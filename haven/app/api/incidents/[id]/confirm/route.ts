import { clientIp, json, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { confirmIncident } from "@/server/services/incidents";

export const POST = route(async (req: Request, ctx: RouteContext<"/api/incidents/[id]/confirm">) => {
  const { id } = await ctx.params;
  const user = await requireUser(clientIp(req));
  const added = await confirmIncident(id, user);
  return json({ ok: true, added });
});
