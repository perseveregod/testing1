import { z } from "zod";
import { clientIp, json, parseBody, route } from "@/server/http";
import { requireUser, toViewer } from "@/server/auth/session";
import { confirmCheckout } from "@/server/billing";

const schema = z.object({ sessionId: z.string().min(8).max(200) });

export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  const { sessionId } = await parseBody(req, schema);
  await confirmCheckout(sessionId, user);
  return json({ viewer: await toViewer(user) });
});
