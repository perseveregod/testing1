import { communityFlagSchema } from "@/lib/validation";
import { clientIp, json, parseBody, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { flagCommunityItem } from "@/server/services/community";

export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  const { kind, id } = await parseBody(req, communityFlagSchema);
  return json(await flagCommunityItem(kind, id, user));
});
