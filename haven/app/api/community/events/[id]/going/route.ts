import { goingSchema } from "@/lib/validation";
import { clientIp, json, parseBody, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { setCommunityGoing } from "@/server/services/community";

export const POST = route(async (req: Request, ctx: RouteContext<"/api/community/events/[id]/going">) => {
  const { id } = await ctx.params;
  const user = await requireUser(clientIp(req));
  const { going } = await parseBody(req, goingSchema);
  return json(await setCommunityGoing(id, going, user));
});
