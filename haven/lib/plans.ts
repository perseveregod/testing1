import type { PlanId, PlanLimits } from "./types";
import { FEATURES } from "./features";

// Entitlements by plan. The server enforces these; the client only uses them
// to show locks and explain limits. Prices live in server/billing/config.ts so
// they can change without touching any of this.

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxAlertRadiusMi: 5,
    maxSavedPlaces: 1,
    historyHours: 24,
    advancedFilters: false,
    quietHours: false,
    placeRules: false,
    insightsDays: 7,
  },
  lifetime: {
    maxAlertRadiusMi: 25,
    maxSavedPlaces: 10,
    historyHours: 24 * 90,
    advancedFilters: true,
    quietHours: true,
    placeRules: true,
    insightsDays: 30,
  },
};

export const RADIUS_OPTIONS_MI = [1, 3, 5, 10, 25] as const;

export function limitsFor(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan];
}

export const LIFETIME_FEATURES: { title: string; detail: string }[] = [
  { title: "Alerts up to 25 miles", detail: "Free covers 5 miles around you" },
  { title: "Up to 10 saved places", detail: "Home, work, school, family and more" },
  { title: "Per-place alert rules", detail: "Different radius and categories for Home vs. Work" },
  ...(FEATURES.insights ? [{ title: "Area insights", detail: "30-day trends by category near you and your places" }] : []),
  { title: "90 days of history", detail: "Free shows the last 24 hours" },
  { title: "Advanced filters", detail: "Severity, verified-only and time range" },
  { title: "Quiet hours", detail: "Only critical alerts overnight" },
  { title: "Future premium features", detail: "Included, with no renewals" },
];

export const FREE_FEATURES: string[] = [
  "Live incident map and feed",
  "Report and confirm incidents",
  "Alerts within 5 miles",
  "One saved place",
  "Last 24 hours of history",
];
