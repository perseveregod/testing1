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
  // Storm Mode (only shown while Storm Mode is on)
  | "power"
  | "flooding"
  | "place"
  | "other";

/** What a storm report says. Each storm category has a pair of states. */
export type StormState = "out" | "on" | "flooded" | "passable" | "open" | "closed";

/** For "place" storm reports: what kind of place. */
export type StormPlaceType = "gas" | "grocery" | "laundromat" | "restaurant" | "cooling" | "charging";

export interface StormInfo {
  state: StormState;
  placeType: StormPlaceType | null;
}

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
  /** Storm Mode reports only. */
  storm?: StormInfo | null;
  /** A photo is stored separately (see Store.getPhoto). */
  hasPhoto?: boolean;
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
  /** Whose severity this is: the source's own rating, or Haven's estimate from the report. */
  severityBy?: "source" | "haven";
}

/**
 * Why an incident has the status it has, so the app can say it in plain words
 * instead of leaving "Active" and "Ended" to be guessed at.
 */
export type StatusBasis =
  /** An official feed still listed it as active the last time Haven checked. */
  | "source_listed"
  /** The official feed stopped listing it, or said it ended. */
  | "source_ended"
  /** A person reported it and nobody has marked it over. */
  | "community_open"
  /** People nearby marked it over. */
  | "community_ended"
  /** No activity for a while: Haven assumes it is over. Nobody confirmed that. */
  | "aged_out"
  /** Hidden while flagged problems are reviewed. */
  | "review";

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
  statusBasis: StatusBasis;
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
  /** Storm Mode reports only. */
  storm: StormInfo | null;
  hasPhoto: boolean;
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
  /** A small JPEG data URL, when the reporter attached one. */
  photo: string | null;
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
  /** Sample alert shown in demo mode so the inbox isn't empty. */
  isDemo?: boolean;
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
  /** "test": nothing real is charged. "live": real payments, confirmed working. "unavailable": can't buy yet. */
  mode: "live" | "test" | "unavailable";
  /** Set when the viewer's verified email is a .edu address: this price already includes the student discount. */
  student: { fullFormatted: string; percentOff: number } | null;
  /** Student price shown to everyone, so students know to sign in with their .edu email. */
  studentFormatted: string;
}
