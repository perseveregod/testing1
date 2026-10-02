import { createReportSchema } from "@/lib/validation";
import { clientIp, json, parseBody, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { createReport } from "@/server/services/incidents";

export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  const user = await requireUser(ip);
  const input = await parseBody(req, createReportSchema);
  const result = await createReport(input, user, ip);
  return json(result, 201);
});
