import { json, route } from "@/server/http";
import { currentUser } from "@/server/auth/session";
import { getCommunityEvent } from "@/server/services/community";

export const GET = route(async (_req: Request, ctx: RouteContext<"/api/community/events/[id]">) => {
  const { id } = await ctx.params;
  const user = await currentUser();
  const event = await getCommunityEvent(id, user);
  return json({ event });
});
