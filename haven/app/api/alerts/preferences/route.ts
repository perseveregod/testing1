import { alertPrefsSchema } from "@/lib/validation";
import { ApiError, clientIp, json, parseBody, route } from "@/server/http";
import { currentUser, requireUser, toViewer } from "@/server/auth/session";
import { DEFAULT_ALERT_PREFS, saveAlertPrefs } from "@/server/services/alerts";
import { getStore } from "@/server/store";

export const GET = route(async () => {
  const user = await currentUser();
  const prefs = (user && (await getStore().getAlertPrefs(user.id))) ?? DEFAULT_ALERT_PREFS;
  return json({ prefs });
});

export const PUT = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  const viewer = await toViewer(user);
  const prefs = await parseBody(req, alertPrefsSchema);
  if (prefs.radiusMi > viewer.limits.maxAlertRadiusMi) {
    throw new ApiError(403, `Your plan supports alerts up to ${viewer.limits.maxAlertRadiusMi} miles.`, "premium_required");
  }
  if ((prefs.quietHoursStart || prefs.quietHoursEnd) && !viewer.limits.quietHours) {
    throw new ApiError(403, "Quiet hours are part of Haven Lifetime.", "premium_required");
  }
  // Also forgets the stored location as soon as near-me alerts stop.
  await saveAlertPrefs(user.id, prefs);
  return json({ prefs });
});
