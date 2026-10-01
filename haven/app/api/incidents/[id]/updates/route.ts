import { incidentUpdateSchema } from "@/lib/validation";
import { clientIp, json, parseBody, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { addInfo } from "@/server/services/incidents";

export const POST = route(async (req: Request, ctx: RouteContext<"/api/incidents/[id]/updates">) => {
  const { id } = await ctx.params;
  const user = await requireUser(clientIp(req));
  const { body } = await parseBody(req, incidentUpdateSchema);
  const result = await addInfo(id, user, body);
  return json({ ok: true, ...result }, 201);
});
