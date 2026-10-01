import { approximate } from "@/lib/geo";
import { locationSchema } from "@/lib/validation";
import { clientIp, json, parseBody, rateLimit, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { getStore } from "@/server/store";

// Stores an approximate (~1 km) location, used only for "near me" alerts.
// Clearing it (DELETE) happens automatically when near-me alerts are turned off.
export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  rateLimit(`loc:${user.id}`, 30, 3_600_000);
  const body = await parseBody(req, locationSchema);
  const prefs = await getStore().getAlertPrefs(user.id);
  if (!prefs?.nearMe) return json({ stored: false });
  const p = approximate({ lat: body.latitude, lng: body.longitude }, 2);
  await getStore().updateUser(user.id, { lastLat: p.lat, lastLng: p.lng, lastLocationAt: new Date().toISOString() });
  return json({ stored: true });
});

export const DELETE = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  await getStore().updateUser(user.id, { lastLat: null, lastLng: null, lastLocationAt: null });
  return json({ stored: false });
});
