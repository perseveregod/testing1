import { clientIp, json, route } from "@/server/http";
import { requireUser, toViewer } from "@/server/auth/session";
import { listMyReports } from "@/server/services/incidents";

export const GET = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  const items = await listMyReports(user, await toViewer(user));
  return json({ items });
});
