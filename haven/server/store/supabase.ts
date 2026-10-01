import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AlertPreferences,
  CategoryId,
  DataSource,
  IncidentRecord,
  IncidentUpdateRecord,
  NotificationItem,
  PlanId,
  SavedPlace,
  StormInfo,
  StormPlaceType,
  StormState,
} from "@/lib/types";
import { ApiError } from "../http";
import type {
  AlertCandidate,
  EntitlementRecord,
  IncidentQuery,
  PlaceCandidate,
  ReportRecord,
  Store,
  UserRecord,
  VoteKind,
} from "./types";

// Production store backed by Supabase Postgres (schema in supabase/migrations).
// Uses the service-role key, so it must only ever run on the server.

type Row = Record<string, unknown>;

const PG_UNIQUE_VIOLATION = "23505";

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(`[supabase] ${res.error.message}`);
  return res.data;
}

const str = (v: unknown) => (v == null ? null : String(v));
const iso = (v: unknown) => new Date(String(v)).toISOString();

function toUser(r: Row): UserRecord {
  return {
    id: String(r.id),
    email: str(r.email),
    displayName: String(r.display_name),
    createdAt: iso(r.created_at),
    lastLat: (r.last_lat as number | null) ?? null,
    lastLng: (r.last_lng as number | null) ?? null,
    lastLocationAt: r.last_location_at ? iso(r.last_location_at) : null,
  };
}

function toIncident(r: Row): IncidentRecord {
  return {
    id: String(r.id),
    category: r.category as CategoryId,
    title: String(r.title),
    description: String(r.description ?? ""),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    approximateAddress: String(r.approximate_address ?? ""),
    severity: r.severity as IncidentRecord["severity"],
    status: r.status as IncidentRecord["status"],
    sourceId: String(r.source_id),
    externalId: str(r.external_id),
    reporterId: str(r.reporter_id),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    confirmationCount: Number(r.confirmation_count ?? 0),
    endedCount: Number(r.ended_count ?? 0),
    flagCount: Number(r.flag_count ?? 0),
    mergedIntoId: str(r.merged_into_id),
    storm: r.storm_state ? { state: r.storm_state as StormState, placeType: (str(r.storm_place_type) as StormPlaceType | null) ?? null } : null,
    hasPhoto: Boolean(r.has_photo),
  };
}

const INCIDENT_COLUMNS: Record<keyof IncidentRecord, string> = {
  id: "id",
  category: "category",
  title: "title",
  description: "description",
  latitude: "latitude",
  longitude: "longitude",
  approximateAddress: "approximate_address",
  severity: "severity",
  status: "status",
  sourceId: "source_id",
  externalId: "external_id",
  reporterId: "reporter_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
  confirmationCount: "confirmation_count",
  endedCount: "ended_count",
  flagCount: "flag_count",
  mergedIntoId: "merged_into_id",
  storm: "", // expanded to storm_state / storm_place_type in fromIncident
  hasPhoto: "has_photo",
};

function fromIncident(p: Partial<IncidentRecord>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === "storm") {
      // Only written for storm reports, so databases without the Storm Mode
      // columns keep working for everything else.
      const st = v as StormInfo | null | undefined;
      if (st) {
        out.storm_state = st.state;
        out.storm_place_type = st.placeType;
      }
      continue;
    }
    if (k === "hasPhoto" && !v) continue;
    const col = INCIDENT_COLUMNS[k as keyof IncidentRecord];
    // Counters are owned by database triggers.
    if (col && !["confirmation_count", "ended_count", "flag_count"].includes(col)) out[col] = v;
  }
  return out;
}

function toPlace(r: Row): SavedPlace {
  return {
    id: String(r.id),
    kind: r.kind as SavedPlace["kind"],
    label: String(r.label),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    address: String(r.address ?? ""),
    alertsEnabled: Boolean(r.alerts_enabled),
    radiusMi: r.radius_mi == null ? null : Number(r.radius_mi),
    categories: (r.categories as CategoryId[] | null) ?? null,
    createdAt: iso(r.created_at),
  };
}

function toPrefs(r: Row): AlertPreferences {
  return {
    enabled: Boolean(r.enabled),
    radiusMi: Number(r.radius_mi),
    categories: (r.categories as CategoryId[]) ?? [],
    savedPlaceAlerts: Boolean(r.saved_place_alerts),
    criticalOnly: Boolean(r.critical_only),
    quietHoursStart: str(r.quiet_hours_start),
    quietHoursEnd: str(r.quiet_hours_end),
    timeZone: str(r.time_zone),
    nearMe: Boolean(r.near_me),
  };
}

function toReport(r: Row): ReportRecord {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    incidentId: String(r.incident_id),
    category: r.category as CategoryId,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    description: String(r.description ?? ""),
    clientRequestId: str(r.client_request_id),
    merged: Boolean(r.merged),
    createdAt: iso(r.created_at),
  };
}

function toNotification(r: Row): NotificationItem {
  return {
    id: String(r.id),
    incidentId: String(r.incident_id),
    title: String(r.title),
    body: String(r.body),
    category: r.category as CategoryId,
    severity: r.severity as NotificationItem["severity"],
    createdAt: iso(r.created_at),
    readAt: r.read_at ? iso(r.read_at) : null,
  };
}

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // users ---------------------------------------------------------------
  async createUser(input: { email?: string | null; displayName: string }) {
    const data = check(
      await this.db
        .from("users")
        .insert({ email: input.email ?? null, display_name: input.displayName })
        .select()
        .single(),
    );
    return toUser(data);
  }
  async getUser(id: string) {
    const data = check(await this.db.from("users").select().eq("id", id).maybeSingle());
    return data ? toUser(data) : null;
  }
  async getUserByEmail(email: string) {
    const data = check(await this.db.from("users").select().eq("email", email).maybeSingle());
    return data ? toUser(data) : null;
  }
  async updateUser(id: string, patch: Partial<UserRecord>) {
    const row: Row = {};
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.lastLat !== undefined) row.last_lat = patch.lastLat;
    if (patch.lastLng !== undefined) row.last_lng = patch.lastLng;
    if (patch.lastLocationAt !== undefined) row.last_location_at = patch.lastLocationAt;
    check(await this.db.from("users").update(row).eq("id", id));
  }

  // entitlements ----------------------------------------------------------
  async getEntitlement(userId: string) {
    const r = check(
      await this.db.from("entitlements").select().eq("user_id", userId).limit(1).maybeSingle(),
    );
    if (!r) return null;
    return {
      userId: String(r.user_id),
      plan: r.plan as PlanId,
      source: r.source as EntitlementRecord["source"],
      externalRef: String(r.external_ref),
      amountCents: Number(r.amount_cents),
      currency: String(r.currency),
      grantedAt: iso(r.granted_at),
    };
  }
  async grantEntitlement(e: EntitlementRecord) {
    const res = await this.db.from("entitlements").insert({
      user_id: e.userId,
      plan: e.plan,
      source: e.source,
      external_ref: e.externalRef,
      amount_cents: e.amountCents,
      currency: e.currency,
      granted_at: e.grantedAt,
    });
    if (res.error?.code === PG_UNIQUE_VIOLATION) return false;
    check(res);
    return true;
  }

  // incidents -------------------------------------------------------------
  async queryIncidents(q: IncidentQuery) {
    if (q.center && q.radiusM) {
      const data = check(
        await this.db.rpc("incidents_nearby", {
          p_lat: q.center.lat,
          p_lng: q.center.lng,
          p_radius_m: q.radiusM,
          p_since: q.since,
          p_categories: q.categories?.length ? q.categories : null,
          p_limit: q.limit,
        }),
      ) as Row[];
      return data.map(toIncident);
    }
    let query = this.db
      .from("incidents")
      .select()
      .is("merged_into_id", null)
      .gte("updated_at", q.since)
      .order("updated_at", { ascending: false })
      .limit(q.limit);
    if (q.categories?.length) query = query.in("category", q.categories);
    return (check(await query) as Row[]).map(toIncident);
  }
  async getIncident(id: string) {
    const data = check(await this.db.from("incidents").select().eq("id", id).maybeSingle());
    return data ? toIncident(data) : null;
  }
  async getIncidentByExternalId(sourceId: string, externalId: string) {
    const data = check(
      await this.db
        .from("incidents")
        .select()
        .eq("source_id", sourceId)
        .eq("external_id", externalId)
        .maybeSingle(),
    );
    return data ? toIncident(data) : null;
  }
  async insertIncident(rec: IncidentRecord) {
    // Counters normally belong to triggers; on insert, seed them (demo data).
    const row = { ...fromIncident(rec), confirmation_count: rec.confirmationCount };
    const res = await this.db.from("incidents").insert(row);
    if (res.error && (rec.storm || rec.category === "missing_pet") && /storm_|has_photo|category_check|column/i.test(res.error.message)) {
      // The database hasn't had the Storm Mode migration yet.
      throw new ApiError(503, "Storm Mode needs a one-time database update before reports can be saved.", "schema_update_needed");
    }
    check(res);
  }
  async savePhoto(incidentId: string, dataUrl: string) {
    check(await this.db.from("incident_photos").upsert({ incident_id: incidentId, data_url: dataUrl }));
  }
  async getPhoto(incidentId: string) {
    const res = await this.db.from("incident_photos").select("data_url").eq("incident_id", incidentId).maybeSingle();
    if (res.error) return null; // table not created yet: no photo
    return res.data ? String((res.data as Row).data_url) : null;
  }
  async updateIncident(id: string, patch: Partial<IncidentRecord>) {
    const row = fromIncident(patch);
    delete row.id;
    if (Object.keys(row).length) check(await this.db.from("incidents").update(row).eq("id", id));
  }
  async deleteIncidentsBySource(sourceId: string) {
    check(await this.db.from("incidents").delete().eq("source_id", sourceId));
  }
  async listUpdates(incidentId: string) {
    const data = check(
      await this.db
        .from("incident_updates")
        .select()
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: true }),
    ) as Row[];
    return data.map(
      (r): IncidentUpdateRecord => ({
        id: String(r.id),
        incidentId: String(r.incident_id),
        kind: r.kind as IncidentUpdateRecord["kind"],
        body: String(r.body),
        authorId: str(r.author_id),
        createdAt: iso(r.created_at),
      }),
    );
  }
  async insertUpdate(rec: IncidentUpdateRecord) {
    check(
      await this.db.from("incident_updates").insert({
        id: rec.id,
        incident_id: rec.incidentId,
        kind: rec.kind,
        body: rec.body,
        author_id: rec.authorId,
        created_at: rec.createdAt,
      }),
    );
  }

  // votes & flags -----------------------------------------------------------
  async getVotes(incidentId: string, userId: string) {
    const data = check(
      await this.db
        .from("incident_confirmations")
        .select("kind")
        .eq("incident_id", incidentId)
        .eq("user_id", userId),
    ) as Row[];
    return data.map((r) => r.kind as VoteKind);
  }
  async insertVote(incidentId: string, userId: string, kind: VoteKind) {
    const res = await this.db
      .from("incident_confirmations")
      .insert({ incident_id: incidentId, user_id: userId, kind });
    if (res.error?.code === PG_UNIQUE_VIOLATION) return false;
    check(res);
    return true;
  }
  async hasFlag(incidentId: string, userId: string) {
    const data = check(
      await this.db
        .from("incident_flags")
        .select("reason")
        .eq("incident_id", incidentId)
        .eq("user_id", userId)
        .maybeSingle(),
    );
    return Boolean(data);
  }
  async insertFlag(incidentId: string, userId: string, reason: string) {
    const res = await this.db
      .from("incident_flags")
      .insert({ incident_id: incidentId, user_id: userId, reason });
    if (res.error?.code === PG_UNIQUE_VIOLATION) return false;
    check(res);
    return true;
  }

  // reports ---------------------------------------------------------------
  async insertReport(rec: ReportRecord) {
    check(
      await this.db.from("reports").insert({
        id: rec.id,
        user_id: rec.userId,
        incident_id: rec.incidentId,
        category: rec.category,
        latitude: rec.latitude,
        longitude: rec.longitude,
        description: rec.description,
        client_request_id: rec.clientRequestId,
        merged: rec.merged,
        created_at: rec.createdAt,
      }),
    );
  }
  async countReportsSince(userId: string, since: string) {
    const res = await this.db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (res.error) throw new Error(`[supabase] ${res.error.message}`);
    return res.count ?? 0;
  }
  async findReportByClientId(userId: string, clientRequestId: string) {
    const data = check(
      await this.db
        .from("reports")
        .select()
        .eq("user_id", userId)
        .eq("client_request_id", clientRequestId)
        .maybeSingle(),
    );
    return data ? toReport(data) : null;
  }
  async listReportsByUser(userId: string, limit: number) {
    const data = check(
      await this.db
        .from("reports")
        .select()
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ) as Row[];
    return data.map(toReport);
  }

  // places ----------------------------------------------------------------
  async listPlaces(userId: string) {
    const data = check(
      await this.db
        .from("saved_locations")
        .select()
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ) as Row[];
    return data.map(toPlace);
  }
  async insertPlace(userId: string, p: SavedPlace) {
    check(
      await this.db.from("saved_locations").insert({
        id: p.id,
        user_id: userId,
        kind: p.kind,
        label: p.label,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
        alerts_enabled: p.alertsEnabled,
        radius_mi: p.radiusMi,
        categories: p.categories,
        created_at: p.createdAt,
      }),
    );
  }
  async updatePlace(userId: string, id: string, p: Partial<SavedPlace>) {
    const row: Row = {};
    if (p.kind !== undefined) row.kind = p.kind;
    if (p.label !== undefined) row.label = p.label;
    if (p.latitude !== undefined) row.latitude = p.latitude;
    if (p.longitude !== undefined) row.longitude = p.longitude;
    if (p.address !== undefined) row.address = p.address;
    if (p.alertsEnabled !== undefined) row.alerts_enabled = p.alertsEnabled;
    if (p.radiusMi !== undefined) row.radius_mi = p.radiusMi;
    if (p.categories !== undefined) row.categories = p.categories;
    const data = check(
      await this.db.from("saved_locations").update(row).eq("id", id).eq("user_id", userId).select("id"),
    ) as Row[];
    return data.length > 0;
  }
  async deletePlace(userId: string, id: string) {
    const data = check(
      await this.db.from("saved_locations").delete().eq("id", id).eq("user_id", userId).select("id"),
    ) as Row[];
    return data.length > 0;
  }

  // alerts ----------------------------------------------------------------
  async getAlertPrefs(userId: string) {
    const data = check(
      await this.db.from("alert_preferences").select().eq("user_id", userId).maybeSingle(),
    );
    return data ? toPrefs(data) : null;
  }
  async saveAlertPrefs(userId: string, p: AlertPreferences) {
    check(
      await this.db.from("alert_preferences").upsert({
        user_id: userId,
        enabled: p.enabled,
        radius_mi: p.radiusMi,
        categories: p.categories,
        saved_place_alerts: p.savedPlaceAlerts,
        critical_only: p.criticalOnly,
        quiet_hours_start: p.quietHoursStart,
        quiet_hours_end: p.quietHoursEnd,
        time_zone: p.timeZone,
        near_me: p.nearMe,
        updated_at: new Date().toISOString(),
      }),
    );
  }
  async findAlertCandidates(center: { lat: number; lng: number }, radiusM: number) {
    const args = { p_lat: center.lat, p_lng: center.lng, p_radius_m: radiusM };
    const [users, places] = await Promise.all([
      this.db.rpc("alert_user_candidates", args),
      this.db.rpc("alert_place_candidates", args),
    ]);
    return {
      users: (check(users) as Row[]).map(
        (r): AlertCandidate => ({
          userId: String(r.user_id),
          lastLat: r.last_lat as number | null,
          lastLng: r.last_lng as number | null,
          prefs: toPrefs(r.prefs as Row),
          plan: r.plan as PlanId,
        }),
      ),
      places: (check(places) as Row[]).map(
        (r): PlaceCandidate => ({ ...toPlace(r), userId: String(r.user_id) }),
      ),
    };
  }

  // notifications ---------------------------------------------------------
  async listNotifications(userId: string, limit: number) {
    const data = check(
      await this.db
        .from("notifications")
        .select()
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ) as Row[];
    return data.map(toNotification);
  }
  async insertNotifications(items: (NotificationItem & { userId: string })[]) {
    if (!items.length) return 0;
    const data = check(
      await this.db
        .from("notifications")
        .upsert(
          items.map((n) => ({
            id: n.id,
            user_id: n.userId,
            incident_id: n.incidentId,
            title: n.title,
            body: n.body,
            category: n.category,
            severity: n.severity,
            created_at: n.createdAt,
          })),
          { onConflict: "user_id,incident_id", ignoreDuplicates: true },
        )
        .select("id"),
    ) as Row[];
    return data.length;
  }
  async markNotificationsRead(userId: string, ids: string[] | "all") {
    let q = this.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (ids !== "all") q = q.in("id", ids);
    check(await q);
  }

  // sources ---------------------------------------------------------------
  async listSources() {
    const data = check(await this.db.from("data_sources").select()) as Row[];
    return data.map(
      (r): DataSource => ({
        id: String(r.id),
        name: String(r.name),
        kind: r.kind as DataSource["kind"],
        attribution: String(r.attribution),
        url: r.url ? String(r.url) : undefined,
        enabled: Boolean(r.enabled),
        lastSyncedAt: r.last_synced_at ? iso(r.last_synced_at) : null,
      }),
    );
  }
  async upsertSource(s: DataSource) {
    check(
      await this.db.from("data_sources").upsert({
        id: s.id,
        name: s.name,
        kind: s.kind,
        attribution: s.attribution,
        url: s.url ?? null,
        enabled: s.enabled,
        last_synced_at: s.lastSyncedAt ?? null,
      }),
    );
  }
}
