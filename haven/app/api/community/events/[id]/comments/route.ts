import { commentSchema } from "@/lib/validation";
import { clientIp, json, parseBody, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { addCommunityComment } from "@/server/services/community";

export const POST = route(async (req: Request, ctx: RouteContext<"/api/community/events/[id]/comments">) => {
  const { id } = await ctx.params;
  const ip = clientIp(req);
  const user = await requireUser(ip);
  const input = await parseBody(req, commentSchema);
  const comment = await addCommunityComment(id, input, user, ip);
  return json({ comment }, 201);
});
