import { randomUUID } from "node:crypto";
import { getCategory, SEVERITY_RANK } from "@/lib/categories";
import { distanceMiles, formatDistance, METERS_PER_MILE } from "@/lib/geo";
import { limitsFor, PLAN_LIMITS } from "@/lib/plans";
import type { AlertPreferences, IncidentRecord, NotificationItem, PlanId } from "@/lib/types";
import { getStore } from "../store";

// Decides who hears about a new incident. A person is notified at most once
// per incident, either for being near it (approximate last location, only if
// they turned on "near me") or for one of their saved places.

export const DEFAULT_ALERT_PREFS: AlertPreferences = {
  enabled: true,
  radiusMi: 3,
  categories: [],
  savedPlaceAlerts: true,
  criticalOnly: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  timeZone: null,
  nearMe: false,
};

/** Clamp stored prefs to what the person's plan allows today. */
export function effectivePrefs(prefs: AlertPreferences, plan: PlanId): AlertPreferences {
  const limits = limitsFor(plan);
  return {
    ...prefs,
    radiusMi: Math.min(prefs.radiusMi, limits.maxAlertRadiusMi),
    quietHoursStart: limits.quietHours ? prefs.quietHoursStart : null,
    quietHoursEnd: limits.quietHours ? prefs.quietHoursEnd : null,
  };
}

function minutesOfDay(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

export function inQuietHours(prefs: AlertPreferences, now: Date): boolean {
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;
  let local: string;
  try {
    local = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: prefs.timeZone ?? "UTC",
    }).format(now);
  } catch {
    return false;
  }
  const t = minutesOfDay(local);
  const start = minutesOfDay(prefs.quietHoursStart);
  const end = minutesOfDay(prefs.quietHoursEnd);
  return start <= end ? t >= start && t < end : t >= start || t < end;
}

export function wantsIncident(prefs: AlertPreferences, inc: IncidentRecord, now: Date): boolean {
  if (!prefs.enabled) return false;
  if (prefs.categories.length && !prefs.categories.includes(inc.category)) return false;
  const critical = SEVERITY_RANK[inc.severity] >= SEVERITY_RANK.critical;
  if (prefs.criticalOnly && !critical) return false;
  if (!critical && inQuietHours(prefs, now)) return false;
  return true;
}

export async function dispatchAlerts(inc: IncidentRecord, excludeUserId: string | null): Promise<number> {
  const store = getStore();
  const now = new Date();
  const maxRadiusM = PLAN_LIMITS.lifetime.maxAlertRadiusMi * METERS_PER_MILE;
  const point = { lat: inc.latitude, lng: inc.longitude };
  const { users, places } = await store.findAlertCandidates(point, maxRadiusM);
  const cat = getCategory(inc.category);
  const out = new Map<string, NotificationItem & { userId: string }>();

  const make = (userId: string, body: string): NotificationItem & { userId: string } => ({
    id: randomUUID(),
    userId,
    incidentId: inc.id,
    title: `${cat.label}${inc.severity === "critical" ? " · Critical" : ""}`,
    body,
    category: inc.category,
    severity: inc.severity,
    createdAt: now.toISOString(),
    readAt: null,
  });

  // Saved places first: "near Home" is more useful than "near you".
  const prefsCache = new Map<string, { prefs: AlertPreferences; plan: PlanId }>();
  for (const place of places) {
    if (place.userId === excludeUserId || out.has(place.userId)) continue;
    let entry = prefsCache.get(place.userId);
    if (!entry) {
      const [prefs, ent] = await Promise.all([store.getAlertPrefs(place.userId), store.getEntitlement(place.userId)]);
      const plan = ent?.plan ?? "free";
      entry = { prefs: effectivePrefs(prefs ?? DEFAULT_ALERT_PREFS, plan), plan };
      prefsCache.set(place.userId, entry);
    }
    if (!entry.prefs.savedPlaceAlerts) continue;
    // Lifetime places can carry their own radius and categories.
    const rules = limitsFor(entry.plan).placeRules;
    const prefs: AlertPreferences = {
      ...entry.prefs,
      radiusMi: rules && place.radiusMi != null ? Math.min(place.radiusMi, limitsFor(entry.plan).maxAlertRadiusMi) : entry.prefs.radiusMi,
      categories: rules && place.categories != null ? place.categories : entry.prefs.categories,
    };
    if (!wantsIncident(prefs, inc, now)) continue;
    const d = distanceMiles(point, { lat: place.latitude, lng: place.longitude });
    if (d > prefs.radiusMi) continue;
    out.set(place.userId, make(place.userId, `${formatDistance(d)} from ${place.label}${inc.approximateAddress ? ` · ${inc.approximateAddress}` : ""}`));
  }

  for (const u of users) {
    if (u.userId === excludeUserId || out.has(u.userId) || u.lastLat == null || u.lastLng == null) continue;
    const prefs = effectivePrefs(u.prefs, u.plan);
    if (!wantsIncident(prefs, inc, now)) continue;
    const d = distanceMiles(point, { lat: u.lastLat, lng: u.lastLng });
    if (d > prefs.radiusMi) continue;
    out.set(u.userId, make(u.userId, `About ${formatDistance(d)} from you${inc.approximateAddress ? ` · ${inc.approximateAddress}` : ""}`));
  }

  if (!out.size) return 0;
  // Delivery: notifications land in the in-app inbox (polled by clients).
  // A push provider (Web Push / APNs / FCM) plugs in here later.
  return store.insertNotifications([...out.values()]);
}
