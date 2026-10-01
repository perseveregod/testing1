import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { boundingBox, distanceMeters } from "@/lib/geo";
import { eventEndsAt } from "@/lib/community";
import type {
  AlertPreferences,
  DataSource,
  IncidentRecord,
  IncidentUpdateRecord,
  NotificationItem,
  SavedPlace,
} from "@/lib/types";
import type {
  AlertCandidate,
  EntitlementRecord,
  EventCommentRecord,
  EventQuery,
  EventRecord,
  IncidentQuery,
  PlaceCandidate,
  ReportRecord,
  Store,
  UserRecord,
  VoteKind,
} from "./types";

// Development store: everything in memory, persisted to one JSON file with
// atomic writes. Good for demos and tests; not for multi-instance production.

interface Data {
  version: 1;
  users: UserRecord[];
  entitlements: EntitlementRecord[];
  incidents: IncidentRecord[];
  updates: IncidentUpdateRecord[];
  votes: { incidentId: string; userId: string; kind: VoteKind; createdAt: string }[];
  flags: { incidentId: string; userId: string; reason: string; createdAt: string }[];
  reports: ReportRecord[];
  places: (SavedPlace & { userId: string })[];
  alertPrefs: (AlertPreferences & { userId: string })[];
  notifications: (NotificationItem & { userId: string })[];
  sources: DataSource[];
  photos: Record<string, string>;
  events: EventRecord[];
  eventComments: EventCommentRecord[];
  rsvps: { eventId: string; userId: string; createdAt: string }[];
  communityFlags: { kind: "event" | "comment"; id: string; userId: string; createdAt: string }[];
}

const empty = (): Data => ({
  version: 1,
  users: [],
  entitlements: [],
  incidents: [],
  updates: [],
  votes: [],
  flags: [],
  reports: [],
  photos: {},
  places: [],
  alertPrefs: [],
  notifications: [],
  sources: [],
  events: [],
  eventComments: [],
  rsvps: [],
  communityFlags: [],
});

const MAX_NOTIFICATIONS_PER_USER = 200;

export class LocalStore implements Store {
  readonly kind = "local" as const;
  private data: Data;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private file: string | null) {
    this.data = empty();
    if (file && fs.existsSync(file)) {
      try {
        this.data = { ...empty(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
      } catch (err) {
        console.error(`[haven] Could not read ${file}; starting empty.`, err);
      }
    }
  }

  private save() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 150);
  }

  flush() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }

  // users ---------------------------------------------------------------
  async createUser(input: { email?: string | null; displayName: string }) {
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email ?? null,
      displayName: input.displayName,
      createdAt: new Date().toISOString(),
      lastLat: null,
      lastLng: null,
      lastLocationAt: null,
    };
    this.data.users.push(user);
    this.save();
    return user;
  }
  async getUser(id: string) {
    return this.data.users.find((u) => u.id === id) ?? null;
  }
  async getUserByEmail(email: string) {
    return this.data.users.find((u) => u.email === email) ?? null;
  }
  async updateUser(id: string, patch: Partial<UserRecord>) {
    const u = this.data.users.find((x) => x.id === id);
    if (u) Object.assign(u, patch, { id: u.id, createdAt: u.createdAt });
    this.save();
  }

  // entitlements ----------------------------------------------------------
  async getEntitlement(userId: string) {
    return this.data.entitlements.find((e) => e.userId === userId) ?? null;
  }
  async grantEntitlement(e: EntitlementRecord) {
    if (this.data.entitlements.some((x) => x.externalRef === e.externalRef)) return false;
    this.data.entitlements.push(e);
    this.save();
    return true;
  }

  // incidents -------------------------------------------------------------
  async queryIncidents(q: IncidentQuery) {
    const since = q.since;
    const box = q.center && q.radiusM ? boundingBox(q.center, q.radiusM) : null;
    const cats = q.categories?.length ? new Set(q.categories) : null;
    const out: IncidentRecord[] = [];
    for (const i of this.data.incidents) {
      if (i.mergedIntoId) continue;
      if (i.updatedAt < since) continue;
      if (cats && !cats.has(i.category)) continue;
      if (box) {
        if (i.latitude < box.minLat || i.latitude > box.maxLat) continue;
        if (i.longitude < box.minLng || i.longitude > box.maxLng) continue;
        if (distanceMeters(q.center!, { lat: i.latitude, lng: i.longitude }) > q.radiusM!) continue;
      }
      out.push(i);
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return out.slice(0, q.limit).map((i) => ({ ...i }));
  }
  async getIncident(id: string) {
    const i = this.data.incidents.find((x) => x.id === id);
    return i ? { ...i } : null;
  }
  async getIncidentByExternalId(sourceId: string, externalId: string) {
    const i = this.data.incidents.find((x) => x.sourceId === sourceId && x.externalId === externalId);
    return i ? { ...i } : null;
  }
  async savePhoto(incidentId: string, dataUrl: string) {
    this.data.photos[incidentId] = dataUrl;
    this.save();
  }
  async getPhoto(incidentId: string) {
    return this.data.photos[incidentId] ?? null;
  }
  async insertIncident(rec: IncidentRecord) {
    this.data.incidents.push({ ...rec });
    this.save();
  }
  async updateIncident(id: string, patch: Partial<IncidentRecord>) {
    const i = this.data.incidents.find((x) => x.id === id);
    if (i) Object.assign(i, patch, { id: i.id });
    this.save();
  }
  async deleteIncidentsBySource(sourceId: string) {
    const ids = new Set(this.data.incidents.filter((i) => i.sourceId === sourceId).map((i) => i.id));
    this.data.incidents = this.data.incidents.filter((i) => !ids.has(i.id));
    this.data.updates = this.data.updates.filter((u) => !ids.has(u.incidentId));
    this.data.votes = this.data.votes.filter((v) => !ids.has(v.incidentId));
    this.data.flags = this.data.flags.filter((f) => !ids.has(f.incidentId));
    this.data.notifications = this.data.notifications.filter((n) => !ids.has(n.incidentId));
    this.save();
  }
  async listUpdates(incidentId: string) {
    return this.data.updates
      .filter((u) => u.incidentId === incidentId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }
  async insertUpdate(rec: IncidentUpdateRecord) {
    this.data.updates.push(rec);
    this.save();
  }

  // votes & flags -----------------------------------------------------------
  async getVotes(incidentId: string, userId: string) {
    return this.data.votes
      .filter((v) => v.incidentId === incidentId && v.userId === userId)
      .map((v) => v.kind);
  }
  async insertVote(incidentId: string, userId: string, kind: VoteKind) {
    if (this.data.votes.some((v) => v.incidentId === incidentId && v.userId === userId && v.kind === kind)) {
      return false;
    }
    this.data.votes.push({ incidentId, userId, kind, createdAt: new Date().toISOString() });
    // Counters are owned by the store (a trigger does this in Postgres).
    const i = this.data.incidents.find((x) => x.id === incidentId);
    if (i) {
      if (kind === "confirm") i.confirmationCount += 1;
      else i.endedCount += 1;
    }
    this.save();
    return true;
  }
  async hasFlag(incidentId: string, userId: string) {
    return this.data.flags.some((f) => f.incidentId === incidentId && f.userId === userId);
  }
  async insertFlag(incidentId: string, userId: string, reason: string) {
    if (await this.hasFlag(incidentId, userId)) return false;
    this.data.flags.push({ incidentId, userId, reason, createdAt: new Date().toISOString() });
    const i = this.data.incidents.find((x) => x.id === incidentId);
    if (i) i.flagCount += 1;
    this.save();
    return true;
  }

  // reports ---------------------------------------------------------------
  async insertReport(rec: ReportRecord) {
    this.data.reports.push(rec);
    this.save();
  }
  async countReportsSince(userId: string, since: string) {
    return this.data.reports.filter((r) => r.userId === userId && r.createdAt >= since).length;
  }
  async findReportByClientId(userId: string, clientRequestId: string) {
    return this.data.reports.find((r) => r.userId === userId && r.clientRequestId === clientRequestId) ?? null;
  }
  async listReportsByUser(userId: string, limit: number) {
    return this.data.reports
      .filter((r) => r.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  // places ----------------------------------------------------------------
  async listPlaces(userId: string) {
    return this.data.places
      .filter((p) => p.userId === userId)
      .map(({ userId: _u, ...p }) => p)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }
  async insertPlace(userId: string, place: SavedPlace) {
    this.data.places.push({ ...place, userId });
    this.save();
  }
  async updatePlace(userId: string, id: string, patch: Partial<SavedPlace>) {
    const p = this.data.places.find((x) => x.id === id && x.userId === userId);
    if (!p) return false;
    Object.assign(p, patch, { id: p.id, userId: p.userId, createdAt: p.createdAt });
    this.save();
    return true;
  }
  async deletePlace(userId: string, id: string) {
    const before = this.data.places.length;
    this.data.places = this.data.places.filter((p) => !(p.id === id && p.userId === userId));
    this.save();
    return this.data.places.length < before;
  }

  // alerts ----------------------------------------------------------------
  async getAlertPrefs(userId: string) {
    const p = this.data.alertPrefs.find((x) => x.userId === userId);
    if (!p) return null;
    const { userId: _u, ...prefs } = p;
    return prefs;
  }
  async saveAlertPrefs(userId: string, prefs: AlertPreferences) {
    this.data.alertPrefs = this.data.alertPrefs.filter((x) => x.userId !== userId);
    this.data.alertPrefs.push({ ...prefs, userId });
    this.save();
  }
  async findAlertCandidates(center: { lat: number; lng: number }, radiusM: number) {
    const box = boundingBox(center, radiusM);
    const inBox = (lat: number, lng: number) =>
      lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
    const users: AlertCandidate[] = [];
    for (const p of this.data.alertPrefs) {
      if (!p.enabled || !p.nearMe) continue;
      const u = this.data.users.find((x) => x.id === p.userId);
      if (!u || u.lastLat == null || u.lastLng == null || !inBox(u.lastLat, u.lastLng)) continue;
      const { userId, ...prefs } = p;
      const ent = this.data.entitlements.find((e) => e.userId === userId);
      users.push({ userId, prefs, lastLat: u.lastLat, lastLng: u.lastLng, plan: ent?.plan ?? "free" });
    }
    const places: PlaceCandidate[] = this.data.places.filter(
      (p) => p.alertsEnabled && inBox(p.latitude, p.longitude),
    );
    return { users, places };
  }

  // notifications ---------------------------------------------------------
  async listNotifications(userId: string, limit: number) {
    return this.data.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map(({ userId: _u, ...n }) => n);
  }
  async insertNotifications(items: (NotificationItem & { userId: string })[]) {
    let n = 0;
    for (const item of items) {
      const dup = this.data.notifications.some(
        (x) => x.userId === item.userId && x.incidentId === item.incidentId,
      );
      if (dup) continue;
      this.data.notifications.push(item);
      n++;
    }
    // Cap per-user inbox size.
    const counts = new Map<string, number>();
    this.data.notifications = this.data.notifications
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .filter((x) => {
        const c = (counts.get(x.userId) ?? 0) + 1;
        counts.set(x.userId, c);
        return c <= MAX_NOTIFICATIONS_PER_USER;
      });
    if (n) this.save();
    return n;
  }
  async markNotificationsRead(userId: string, ids: string[] | "all") {
    const now = new Date().toISOString();
    const set = ids === "all" ? null : new Set(ids);
    for (const n of this.data.notifications) {
      if (n.userId === userId && !n.readAt && (!set || set.has(n.id))) n.readAt = now;
    }
    this.save();
  }

  // community ---------------------------------------------------------------
  async listEvents(q: EventQuery) {
    const endsAfter = new Date(q.endsAfter).getTime();
    return this.data.events
      .filter((e) => !e.hidden && e.startsAt < q.startsBefore)
      .filter((e) => eventEndsAt(e) > endsAfter)
      .filter((e) => distanceMeters(q.center, { lat: e.latitude, lng: e.longitude }) <= q.radiusM)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, q.limit)
      .map((e) => ({ ...e }));
  }
  async getEvent(id: string) {
    const e = this.data.events.find((x) => x.id === id);
    return e ? { ...e } : null;
  }
  async insertEvent(rec: EventRecord) {
    if (this.data.events.some((e) => e.id === rec.id)) return;
    this.data.events.push({ ...rec });
    this.save();
  }
  async hideEvent(id: string) {
    const e = this.data.events.find((x) => x.id === id);
    if (e) e.hidden = true;
    this.save();
  }
  async listEventComments(eventId: string, limit: number) {
    return this.data.eventComments
      .filter((c) => c.eventId === eventId && !c.hidden)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit)
      .map((c) => ({ ...c }));
  }
  async getEventComment(id: string) {
    const c = this.data.eventComments.find((x) => x.id === id);
    return c ? { ...c } : null;
  }
  async insertEventComment(rec: EventCommentRecord) {
    if (this.data.eventComments.some((c) => c.id === rec.id)) return;
    this.data.eventComments.push({ ...rec });
    const e = this.data.events.find((x) => x.id === rec.eventId);
    if (e) e.commentCount += 1;
    this.save();
  }
  async hideEventComment(id: string) {
    const c = this.data.eventComments.find((x) => x.id === id);
    if (c && !c.hidden) {
      c.hidden = true;
      const e = this.data.events.find((x) => x.id === c.eventId);
      if (e) e.commentCount = Math.max(0, e.commentCount - 1);
    }
    this.save();
  }
  async setGoing(eventId: string, userId: string, going: boolean) {
    const has = this.data.rsvps.some((r) => r.eventId === eventId && r.userId === userId);
    if (has === going) return;
    const e = this.data.events.find((x) => x.id === eventId);
    if (going) {
      this.data.rsvps.push({ eventId, userId, createdAt: new Date().toISOString() });
      if (e) e.goingCount += 1;
    } else {
      this.data.rsvps = this.data.rsvps.filter((r) => !(r.eventId === eventId && r.userId === userId));
      if (e) e.goingCount = Math.max(0, e.goingCount - 1);
    }
    this.save();
  }
  async goingEventIds(userId: string, eventIds: string[]) {
    const ids = new Set(eventIds);
    return new Set(this.data.rsvps.filter((r) => r.userId === userId && ids.has(r.eventId)).map((r) => r.eventId));
  }
  async flagCommunityItem(kind: "event" | "comment", id: string, userId: string) {
    const flags = this.data.communityFlags;
    if (!flags.some((f) => f.kind === kind && f.id === id && f.userId === userId)) {
      flags.push({ kind, id, userId, createdAt: new Date().toISOString() });
      const target = kind === "event" ? this.data.events.find((x) => x.id === id) : this.data.eventComments.find((x) => x.id === id);
      if (target) target.flagCount += 1;
      this.save();
    }
    return flags.filter((f) => f.kind === kind && f.id === id).length;
  }
  async countEventsSince(userId: string, since: string) {
    return this.data.events.filter((e) => e.createdBy === userId && e.createdAt >= since).length;
  }
  async countEventCommentsSince(userId: string, since: string) {
    return this.data.eventComments.filter((c) => c.userId === userId && c.createdAt >= since).length;
  }

  // sources ---------------------------------------------------------------
  async listSources() {
    return this.data.sources.map((s) => ({ ...s }));
  }
  async upsertSource(source: DataSource) {
    this.data.sources = this.data.sources.filter((s) => s.id !== source.id);
    this.data.sources.push(source);
    this.save();
  }
}
