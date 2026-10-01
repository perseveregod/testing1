// Shared domain types. Used by the API, the server stores and the client.
// Anything returned to a browser is a "Public*" type: it never contains
// reporter identities or exact reporter locations.

export type CategoryId =
  | "police"
  | "fire"
  | "medical"
  | "traffic_accident"
  | "road_hazard"
  | "suspicious"
  | "severe_weather"
  | "public_safety"
  | "missing_pet"
  | "other";

export type Severity = "low" | "moderate" | "high" | "critical";

/** active → contained → resolved. under_review = hidden after community flags. */
export type IncidentStatus = "active" | "contained" | "resolved" | "under_review";

export type SourceKind = "user" | "demo" | "open_data" | "weather";

export type UpdateKind =
  | "created"
  | "additional_report"
  | "info"
  | "status_change"
  | "severity_change"
  | "source_update";

export interface DataSource {
  id: string;
  name: string;
  kind: SourceKind;
  attribution: string;
  url?: string;
  enabled: boolean;
  lastSyncedAt?: string | null;
}

/** Full incident row as stored. Server-only. */
export interface IncidentRecord {
  id: string;
  category: CategoryId;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  approximateAddress: string;
  severity: Severity;
  status: IncidentStatus;
  sourceId: string;
  externalId: string | null;
  reporterId: string | null;
  createdAt: string;
  updatedAt: string;
  confirmationCount: number;
  endedCount: number;
  flagCount: number;
  mergedIntoId: string | null;
}

export interface IncidentUpdateRecord {
  id: string;
  incidentId: string;
  kind: UpdateKind;
  body: string;
  authorId: string | null;
  createdAt: string;
}

export interface PublicSource {
  id: string;
  name: string;
  kind: SourceKind;
  attribution: string;
  url?: string;
}

export interface PublicIncident {
  id: string;
  category: CategoryId;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  approximateAddress: string;
  severity: Severity;
  /** Effective status: stale active incidents read as resolved. */
  status: IncidentStatus;
  source: PublicSource;
  createdAt: string;
  updatedAt: string;
  confirmationCount: number;
  endedCount: number;
  /** Miles from the point the query was made from, when one was given. */
  distanceMi: number | null;
  /** No other person or official source has backed this up yet. */
  unverified: boolean;
  isDemo: boolean;
}

export interface PublicIncidentUpdate {
  id: string;
  kind: UpdateKind;
  body: string;
  createdAt: string;
  /** Who wrote it, in non-identifying terms. */
  author: "you" | "community" | "source" | "system";
}

export interface IncidentDetail extends PublicIncident {
  updates: PublicIncidentUpdate[];
  /** How many "it's over" votes end a community report (official feeds end themselves). */
  endedVotesNeeded: number;
  viewer: {
    confirmed: boolean;
    markedEnded: boolean;
    flagged: boolean;
    isReporter: boolean;
  };
}

export type PlaceKind = "home" | "work" | "school" | "family" | "custom";

export interface SavedPlace {
  id: string;
  kind: PlaceKind;
  label: string;
  latitude: number;
  longitude: number;
  address: string;
  alertsEnabled: boolean;
  /** Lifetime: override the account-wide alert radius for this place. */
  radiusMi: number | null;
  /** Lifetime: override the account-wide categories (empty = all). */
  categories: CategoryId[] | null;
  createdAt: string;
}

export interface AlertPreferences {
  enabled: boolean;
  radiusMi: number;
  categories: CategoryId[];
  savedPlaceAlerts: boolean;
  criticalOnly: boolean;
  /** Premium: local "HH:MM" window where only critical alerts come through. */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  /** IANA zone the quiet hours are expressed in, e.g. "America/Los_Angeles". */
  timeZone: string | null;
  /** Approximate (~1 km) last location, only kept when "near me" alerts are on. */
  nearMe: boolean;
}

export interface NotificationItem {
  id: string;
  incidentId: string;
  title: string;
  body: string;
  category: CategoryId;
  severity: Severity;
  createdAt: string;
  readAt: string | null;
}

export type PlanId = "free" | "lifetime";

export interface PlanLimits {
  maxAlertRadiusMi: number;
  maxSavedPlaces: number;
  historyHours: number;
  advancedFilters: boolean;
  quietHours: boolean;
  /** Per-saved-place radius and category overrides. */
  placeRules: boolean;
  /** How far back the insights screen can look. */
  insightsDays: number;
}

export interface Viewer {
  id: string;
  email: string | null;
  displayName: string;
  plan: PlanId;
  limits: PlanLimits;
  createdAt: string;
}

export interface PricingInfo {
  planId: "lifetime";
  name: string;
  amountCents: number;
  currency: string;
  formatted: string;
  mode: "stripe" | "test";
}
