import { clientIp, json, rateLimit, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { sendTestPush } from "@/server/push";

/** "Send a test" from the alert settings. */
export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  rateLimit(`push-test:${user.id}`, 5, 10 * 60_000);
  const sent = await sendTestPush(user.id);
  return json({ sent });
});
