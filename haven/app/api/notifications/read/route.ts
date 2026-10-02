import { z } from "zod";
import { clientIp, json, parseBody, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { getStore } from "@/server/store";

const schema = z.object({ ids: z.union([z.literal("all"), z.array(z.string().uuid()).max(200)]) });

export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  const { ids } = await parseBody(req, schema);
  if (ids === "all" || ids.length) await getStore().markNotificationsRead(user.id, ids);
  return json({ ok: true });
});
