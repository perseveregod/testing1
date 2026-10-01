import { clientIp, json, route } from "@/server/http";
import { requireUser, toViewer } from "@/server/auth/session";
import { completeTestCheckout } from "@/server/billing";

// Test-mode only (no Stripe key and not production): simulates a paid checkout.
export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  await completeTestCheckout(user);
  return json({ viewer: await toViewer(user) });
});
