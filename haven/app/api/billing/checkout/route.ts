import { clientIp, json, rateLimit, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { createCheckout } from "@/server/billing";

export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  rateLimit(`checkout:${user.id}`, 10, 3_600_000);
  return json(await createCheckout(user, new URL(req.url).origin));
});
