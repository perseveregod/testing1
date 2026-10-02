import { locationSchema } from "@/lib/validation";
import { clientIp, json, parseBody, rateLimit, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { forgetLocation, rememberLocation } from "@/server/services/alerts";

// One rounded point (within about half a mile), kept only for "near me" alerts.
// It is deleted when those alerts are turned off, and on request (DELETE).
export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  rateLimit(`loc:${user.id}`, 30, 3_600_000);
  const body = await parseBody(req, locationSchema);
  const stored = await rememberLocation(user.id, { lat: body.latitude, lng: body.longitude });
  return json({ stored });
});

export const DELETE = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  await forgetLocation(user.id);
  return json({ stored: false });
});
