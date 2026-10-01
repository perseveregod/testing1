import type {
  AlertPreferences,
  CategoryId,
  DataSource,
  IncidentRecord,
  IncidentUpdateRecord,
  NotificationItem,
  PlanId,
  SavedPlace,
} from "@/lib/types";

// The storage contract. Two implementations exist:
//   - LocalStore: a JSON file for development and demos, zero setup.
//   - SupabaseStore: Postgres via Supabase for production.
// Business rules live in server/services, never in a store.

export interface UserRecord {
  id: string;
  email: string | null;
  displayName: string;
  createdAt: string;
  /** Approximate (2-decimal, ~1 km) location, only when near-me alerts are on. */
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | null;
}

export interface EntitlementRecord {
  userId: string;
  plan: PlanId;
  source: "stripe" | "test" | "admin";
  externalRef: string;
  amountCents: number;
  currency: string;
  grantedAt: string;
}

export type VoteKind = "confirm" | "ended";

export interface ReportRecord {
  id: string;
  userId: string;
  incidentId: string;
  category: CategoryId;
  latitude: number;
  longitude: number;
  description: string;
  clientRequestId: string | null;
  merged: boolean;
  createdAt: string;
}

export interface IncidentQuery {
  center?: { lat: number; lng: number };
  radiusM?: number;
  since: string;
  categories?: CategoryId[];
  limit: number;
}

export interface AlertCandidate {
  userId: string;
  prefs: AlertPreferences;
  lastLat: number | null;
  lastLng: number | null;
  plan: PlanId;
}

export interface PlaceCandidate extends SavedPlace {
  userId: string;
}

export interface Store {
  readonly kind: "local" | "supabase";

  // users
  createUser(input: { email?: string | null; displayName: string }): Promise<UserRecord>;
  getUser(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  updateUser(id: string, patch: Partial<Omit<UserRecord, "id" | "createdAt">>): Promise<void>;

  // entitlements
  getEntitlement(userId: string): Promise<EntitlementRecord | null>;
  /** Idempotent on externalRef. Returns false when it already existed. */
  grantEntitlement(e: EntitlementRecord): Promise<boolean>;

  // incidents
  queryIncidents(q: IncidentQuery): Promise<IncidentRecord[]>;
  getIncident(id: string): Promise<IncidentRecord | null>;
  getIncidentByExternalId(sourceId: string, externalId: string): Promise<IncidentRecord | null>;
  insertIncident(rec: IncidentRecord): Promise<void>;
  updateIncident(id: string, patch: Partial<IncidentRecord>): Promise<void>;
  deleteIncidentsBySource(sourceId: string): Promise<void>;
  listUpdates(incidentId: string): Promise<IncidentUpdateRecord[]>;
  insertUpdate(rec: IncidentUpdateRecord): Promise<void>;

  // Storm report photos (small JPEG data URLs), kept out of list queries.
  savePhoto(incidentId: string, dataUrl: string): Promise<void>;
  getPhoto(incidentId: string): Promise<string | null>;

  // votes (confirmations + "it's over") and flags; one per user per kind.
  // Inserting a vote or flag also bumps the matching counter on the incident.
  getVotes(incidentId: string, userId: string): Promise<VoteKind[]>;
  insertVote(incidentId: string, userId: string, kind: VoteKind): Promise<boolean>;
  hasFlag(incidentId: string, userId: string): Promise<boolean>;
  insertFlag(incidentId: string, userId: string, reason: string): Promise<boolean>;

  // raw user submissions
  insertReport(rec: ReportRecord): Promise<void>;
  countReportsSince(userId: string, since: string): Promise<number>;
  findReportByClientId(userId: string, clientRequestId: string): Promise<ReportRecord | null>;
  listReportsByUser(userId: string, limit: number): Promise<ReportRecord[]>;

  // saved places
  listPlaces(userId: string): Promise<SavedPlace[]>;
  insertPlace(userId: string, place: SavedPlace): Promise<void>;
  updatePlace(userId: string, id: string, patch: Partial<SavedPlace>): Promise<boolean>;
  deletePlace(userId: string, id: string): Promise<boolean>;

  // alerts
  getAlertPrefs(userId: string): Promise<AlertPreferences | null>;
  saveAlertPrefs(userId: string, prefs: AlertPreferences): Promise<void>;
  findAlertCandidates(center: { lat: number; lng: number }, radiusM: number): Promise<{
    users: AlertCandidate[];
    places: PlaceCandidate[];
  }>;

  // notifications
  listNotifications(userId: string, limit: number): Promise<NotificationItem[]>;
  /** Skips any (user, incident) pair that already has a notification. */
  insertNotifications(items: (NotificationItem & { userId: string })[]): Promise<number>;
  markNotificationsRead(userId: string, ids: string[] | "all"): Promise<void>;

  // data sources
  listSources(): Promise<DataSource[]>;
  upsertSource(source: DataSource): Promise<void>;
}
