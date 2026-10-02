import { randomUUID } from "node:crypto";
import { categoriesInGroup, getCategory, isStormCategory, SEVERITY_RANK } from "@/lib/categories";
import { isValidStorm, STORM_HIDE_HOURS, stormSeverity, stormTitle } from "@/lib/storm";
import { approximate, distanceMeters, distanceMiles, METERS_PER_MILE } from "@/lib/geo";
import { moderateText } from "@/lib/moderation";
import { estimateSeverity, maxSeverity } from "@/lib/severity";
import type {
  StormPlaceType,
  StormState,
  CategoryId,
  IncidentDetail,
  IncidentRecord,
  IncidentStatus,
  PublicIncident,
  PublicIncidentUpdate,
  Viewer,
} from "@/lib/types";
import type { ListQuery } from "@/lib/validation";
import { config } from "../config";
import { describeLocation } from "../geocode";
import { ApiError, rateLimit } from "../http";
import { publicSource, USER_SOURCE } from "../sources/registry";
import { getStore, type Store } from "../store";
import type { UserRecord } from "../store/types";
import { dispatchAlerts } from "./alerts";

const HOUR = 3_600_000;
// Community escalation: a high-severity hazard confirmed by this many other
// people becomes critical (and reaches critical-only alert subscribers).
const ESCALATE_CONFIRMATIONS = 3;
const ESCALATABLE: CategoryId[] = ["fire", "public_safety", "severe_weather"];

/** Active incidents with no activity for a while read as ended. */
export function effectiveStatus(rec: IncidentRecord, now = Date.now()): IncidentStatus {
  if (rec.status !== "active" && rec.status !== "contained") return rec.status;
  const staleMs = getCategory(rec.category).staleAfterHours * HOUR;
  return now - new Date(rec.updatedAt).getTime() > staleMs ? "resolved" : rec.status;
}

export function toPublic(rec: IncidentRecord, from?: { lat: number; lng: number } | null): PublicIncident {
  const source = publicSource(rec.sourceId);
  return {
    id: rec.id,
    category: rec.category,
    title: rec.title,
    description: rec.description,
    latitude: rec.latitude,
    longitude: rec.longitude,
    approximateAddress: rec.approximateAddress,
    severity: rec.severity,
    status: effectiveStatus(rec),
    source,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    confirmationCount: rec.confirmationCount,
    endedCount: rec.endedCount,
    distanceMi: from ? distanceMiles(from, { lat: rec.latitude, lng: rec.longitude }) : null,
    unverified: source.kind === "user" && rec.confirmationCount === 0,
    isDemo: source.kind === "demo",
    storm: rec.storm ?? null,
    hasPhoto: Boolean(rec.hasPhoto),
  };
}

export async function listIncidents(q: ListQuery, viewer: Viewer | null) {
  const limits = viewer?.limits ?? { historyHours: 24, advancedFilters: false };
  if (!limits.advancedFilters && (q.minSeverity || q.verifiedOnly)) {
    throw new ApiError(403, "Advanced filters are part of Haven Lifetime.", "premium_required");
  }
  // Storm Mode asks only for storm categories; everything else leaves them out.
  const stormQuery = q.categories.length > 0 && q.categories.every(isStormCategory);
  const sinceHours = stormQuery
    ? Math.min(q.sinceHours ?? STORM_HIDE_HOURS, STORM_HIDE_HOURS)
    : Math.min(q.sinceHours ?? 24, limits.historyHours);
  const center = q.lat != null && q.lng != null ? { lat: q.lat, lng: q.lng } : null;
  const records = await getStore().queryIncidents({
    center: center ?? undefined,
    radiusM: center ? q.radiusMi * METERS_PER_MILE : undefined,
    since: new Date(Date.now() - sinceHours * HOUR).toISOString(),
    categories: q.categories,
    limit: Math.min(500, q.limit * 2),
  });

  let items = records
    // Flagged-for-review incidents stay visible only to the person who reported them.
    .filter((r) => r.status !== "under_review" || (viewer && r.reporterId === viewer.id))
    .filter((r) => (stormQuery ? isStormCategory(r.category) : !isStormCategory(r.category)))
    .map((r) => toPublic(r, center));
  // Storm reports vanish once stale (6h); they never linger as "ended".
  if (!q.includeResolved || stormQuery) items = items.filter((i) => i.status !== "resolved");
  if (q.minSeverity) items = items.filter((i) => SEVERITY_RANK[i.severity] >= SEVERITY_RANK[q.minSeverity!]);
  if (q.verifiedOnly) items = items.filter((i) => !i.unverified);

  items.sort((a, b) =>
    q.sort === "distance" && center
      ? (a.distanceMi ?? 0) - (b.distanceMi ?? 0)
      : b.createdAt.localeCompare(a.createdAt),
  );
  return { items: items.slice(0, q.limit), sinceHours, historyLimited: (q.sinceHours ?? 24) > limits.historyHours };
}

function authorLabel(authorId: string | null, kind: string, viewerId: string | null): PublicIncidentUpdate["author"] {
  if (authorId && authorId === viewerId) return "you";
  if (authorId) return "community";
  return kind === "source_update" || kind === "created" ? "source" : "system";
}

export async function getIncidentDetail(
  id: string,
  viewer: Viewer | null,
  from: { lat: number; lng: number } | null,
): Promise<IncidentDetail> {
  const store = getStore();
  let rec = await store.getIncident(id);
  // Follow merges so old links keep working.
  for (let hops = 0; rec?.mergedIntoId && hops < 3; hops++) rec = await store.getIncident(rec.mergedIntoId);
  if (!rec) throw new ApiError(404, "This incident no longer exists.", "not_found");
  const isReporter = Boolean(viewer && rec.reporterId === viewer.id);
  if (rec.status === "under_review" && !isReporter) {
    throw new ApiError(404, "This incident is under review.", "under_review");
  }
  const [updates, votes, flagged, photo] = await Promise.all([
    store.listUpdates(rec.id),
    viewer ? store.getVotes(rec.id, viewer.id) : Promise.resolve([]),
    viewer ? store.hasFlag(rec.id, viewer.id) : Promise.resolve(false),
    rec.hasPhoto ? store.getPhoto(rec.id) : Promise.resolve(null),
  ]);
  return {
    ...toPublic(rec, from),
    photo,
    updates: updates.map((u) => ({
      id: u.id,
      kind: u.kind,
      body: u.body,
      createdAt: u.createdAt,
      author: authorLabel(u.authorId, u.kind, viewer?.id ?? null),
    })),
    endedVotesNeeded: votesToResolve(rec),
    viewer: {
      confirmed: votes.includes("confirm"),
      markedEnded: votes.includes("ended"),
      flagged,
      isReporter,
    },
  };
}

// ---------------------------------------------------------------------------
// Reporting

export interface CreateReportInput {
  category: CategoryId;
  latitude: number;
  longitude: number;
  description: string;
  clientRequestId?: string;
  /** Storm Mode reports only. */
  storm?: { state: StormState; placeType: StormPlaceType | null } | null;
  /** Storm Mode reports only: a small JPEG data URL. */
  photo?: string;
}

export interface CreateReportResult {
  incidentId: string;
  merged: boolean;
  redacted: boolean;
}

/** An open incident of the same kind, close in space and time, if one exists. */
export async function findDuplicate(
  category: CategoryId,
  point: { lat: number; lng: number },
  now = Date.now(),
): Promise<IncidentRecord | null> {
  const def = getCategory(category);
  const sameGroup = categoriesInGroup(def.group);
  const candidates = await getStore().queryIncidents({
    center: point,
    radiusM: def.dedupeRadiusM,
    since: new Date(now - def.dedupeWindowMin * 60_000).toISOString(),
    categories: sameGroup,
    limit: 20,
  });
  const open = candidates.filter((c) => {
    const st = effectiveStatus(c, now);
    return (st === "active" || st === "contained") && c.sourceId !== "demo";
  });
  // Prefer the exact category, then the closest.
  open.sort((a, b) => {
    const ca = a.category === category ? 0 : 1;
    const cb = b.category === category ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return (
      distanceMeters(point, { lat: a.latitude, lng: a.longitude }) -
      distanceMeters(point, { lat: b.latitude, lng: b.longitude })
    );
  });
  return open[0] ?? null;
}

// Incidents reference a data_sources row. The feeds register theirs while
// ingesting; community reports have no adapter, so register "user" once per
// store before the first report (a failed attempt is retried next time).
const userSourceReady = new WeakMap<Store, Promise<void>>();
function ensureUserSource(store: Store): Promise<void> {
  let p = userSourceReady.get(store);
  if (!p) {
    p = store.upsertSource({ ...USER_SOURCE, enabled: true, lastSyncedAt: null }).catch((err) => {
      userSourceReady.delete(store);
      throw err;
    });
    userSourceReady.set(store, p);
  }
  return p;
}

export async function createReport(
  input: CreateReportInput,
  user: UserRecord,
  ip: string,
): Promise<CreateReportResult> {
  const store = getStore();
  await ensureUserSource(store);

  if (input.clientRequestId) {
    const prior = await store.findReportByClientId(user.id, input.clientRequestId);
    if (prior) return { incidentId: prior.incidentId, merged: prior.merged, redacted: false };
  }

  rateLimit(`report-ip:${ip}`, config.limits.reportsPerHour * 2, HOUR);
  const now = Date.now();
  const [lastHour, lastDay] = await Promise.all([
    store.countReportsSince(user.id, new Date(now - HOUR).toISOString()),
    store.countReportsSince(user.id, new Date(now - 24 * HOUR).toISOString()),
  ]);
  if (lastHour >= config.limits.reportsPerHour || lastDay >= config.limits.reportsPerDay) {
    throw new ApiError(429, "You've sent a lot of reports recently. Please try again later.", "rate_limited");
  }

  const mod = moderateText(input.description);
  if (!mod.ok) throw new ApiError(422, mod.reason, "moderation");

  // Never store the exact point someone tapped: snap to ~110 m.
  const point = approximate({ lat: input.latitude, lng: input.longitude }, 3);

  if (isStormCategory(input.category) || input.storm) {
    return createStormReport(input, user, mod.text, mod.redacted, point, now);
  }
  const severity = estimateSeverity(input.category, mod.text);
  const nowIso = new Date(now).toISOString();
  const duplicate = await findDuplicate(input.category, point, now);

  if (duplicate) {
    await mergeInto(duplicate, user.id, mod.text, severity, nowIso);
    await store.insertReport({
      id: randomUUID(),
      userId: user.id,
      incidentId: duplicate.id,
      category: input.category,
      latitude: point.lat,
      longitude: point.lng,
      description: mod.text,
      clientRequestId: input.clientRequestId ?? null,
      merged: true,
      createdAt: nowIso,
    });
    return { incidentId: duplicate.id, merged: true, redacted: mod.redacted };
  }

  const def = getCategory(input.category);
  const address = await describeLocation(point.lat, point.lng);
  const rec: IncidentRecord = {
    id: randomUUID(),
    category: input.category,
    title: def.label,
    description: mod.text,
    latitude: point.lat,
    longitude: point.lng,
    approximateAddress: address,
    severity,
    status: "active",
    sourceId: "user",
    externalId: null,
    reporterId: user.id,
    createdAt: nowIso,
    updatedAt: nowIso,
    confirmationCount: 0,
    endedCount: 0,
    flagCount: 0,
    mergedIntoId: null,
  };
  await store.insertIncident(rec);
  await store.insertUpdate({
    id: randomUUID(),
    incidentId: rec.id,
    kind: "created",
    body: mod.text ? `First reported: "${mod.text}"` : "First reported by someone nearby.",
    authorId: user.id,
    createdAt: nowIso,
  });
  await store.insertReport({
    id: randomUUID(),
    userId: user.id,
    incidentId: rec.id,
    category: input.category,
    latitude: point.lat,
    longitude: point.lng,
    description: mod.text,
    clientRequestId: input.clientRequestId ?? null,
    merged: false,
    createdAt: nowIso,
  });
  await dispatchAlerts(rec, user.id);
  return { incidentId: rec.id, merged: false, redacted: mod.redacted };
}

/**
 * Storm reports work per block: the same state again counts as a confirmation;
 * a different state (e.g. "power back on" after "power out") replaces the
 * older report, which is hidden and linked to the new one.
 */
async function createStormReport(
  input: CreateReportInput,
  user: UserRecord,
  text: string,
  redacted: boolean,
  point: { lat: number; lng: number },
  now: number,
): Promise<CreateReportResult> {
  const store = getStore();
  const storm = input.storm ? { state: input.storm.state, placeType: input.storm.placeType ?? null } : null;
  if (!storm || !isValidStorm(input.category, storm)) {
    throw new ApiError(422, "That storm report isn't complete.", "invalid_storm");
  }
  const nowIso = new Date(now).toISOString();
  const sameBlock = (
    await store.queryIncidents({
      center: point,
      radiusM: getCategory(input.category).dedupeRadiusM,
      since: new Date(now - STORM_HIDE_HOURS * HOUR).toISOString(),
      categories: [input.category],
      limit: 20,
    })
  ).filter(
    (r) =>
      r.storm &&
      r.storm.placeType === storm.placeType &&
      r.status !== "under_review" &&
      effectiveStatus(r, now) !== "resolved",
  );
  sameBlock.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const current = sameBlock[0];

  const logReport = (incidentId: string, merged: boolean) =>
    store.insertReport({
      id: randomUUID(),
      userId: user.id,
      incidentId,
      category: input.category,
      latitude: point.lat,
      longitude: point.lng,
      description: text,
      clientRequestId: input.clientRequestId ?? null,
      merged,
      createdAt: nowIso,
    });

  if (current && current.storm!.state === storm.state) {
    await mergeInto(current, user.id, text, current.severity, nowIso);
    await logReport(current.id, true);
    return { incidentId: current.id, merged: true, redacted };
  }

  const address = await describeLocation(point.lat, point.lng);
  const id = randomUUID();
  const rec: IncidentRecord = {
    id,
    category: input.category,
    title: stormTitle(storm, "en"),
    description: text,
    latitude: point.lat,
    longitude: point.lng,
    approximateAddress: address,
    severity: stormSeverity(storm.state),
    status: "active",
    sourceId: "user",
    externalId: null,
    reporterId: user.id,
    createdAt: nowIso,
    updatedAt: nowIso,
    confirmationCount: 0,
    endedCount: 0,
    flagCount: 0,
    mergedIntoId: null,
    storm,
    hasPhoto: Boolean(input.photo),
  };
  await store.insertIncident(rec);
  if (input.photo) await store.savePhoto(id, input.photo);
  await store.insertUpdate({
    id: randomUUID(),
    incidentId: id,
    kind: "created",
    body: text ? `Reported: "${text}"` : "Reported by someone nearby.",
    authorId: user.id,
    createdAt: nowIso,
  });
  // Older reports on this block with a different state are superseded.
  for (const old of sameBlock) {
    await store.updateIncident(old.id, { status: "resolved", mergedIntoId: id, updatedAt: nowIso });
  }
  await logReport(id, false);
  return { incidentId: id, merged: false, redacted };
}

/** Attach a new report to an existing incident: it counts as a confirmation. */
async function mergeInto(target: IncidentRecord, userId: string, text: string, severity: IncidentRecord["severity"], nowIso: string) {
  const store = getStore();
  if (target.reporterId !== userId) await store.insertVote(target.id, userId, "confirm");
  await store.insertUpdate({
    id: randomUUID(),
    incidentId: target.id,
    kind: "additional_report",
    body: text ? `Another person reported: "${text}"` : "Another person nearby reported this.",
    authorId: userId,
    createdAt: nowIso,
  });
  const fresh = (await store.getIncident(target.id))!;
  await store.updateIncident(target.id, {
    updatedAt: nowIso,
    severity: escalate(fresh, maxSeverity(fresh.severity, severity)),
  });
}

function escalate(rec: IncidentRecord, severity: IncidentRecord["severity"]) {
  if (
    severity === "high" &&
    ESCALATABLE.includes(rec.category) &&
    rec.confirmationCount >= ESCALATE_CONFIRMATIONS
  ) {
    return "critical";
  }
  return severity;
}

// ---------------------------------------------------------------------------
// Community actions

async function openIncident(id: string): Promise<IncidentRecord> {
  const rec = await getStore().getIncident(id);
  if (!rec || rec.mergedIntoId || rec.status === "under_review") {
    throw new ApiError(404, "This incident no longer exists.", "not_found");
  }
  return rec;
}

export async function confirmIncident(id: string, user: UserRecord) {
  const store = getStore();
  const rec = await openIncident(id);
  if (rec.reporterId === user.id) throw new ApiError(409, "You reported this one.", "own_report");
  if (effectiveStatus(rec) === "resolved") throw new ApiError(409, "This incident has ended.", "resolved");
  rateLimit(`vote:${user.id}`, 60, HOUR);
  const added = await store.insertVote(id, user.id, "confirm");
  if (added) {
    const fresh = (await store.getIncident(id))!;
    const severity = escalate(fresh, fresh.severity);
    const nowIso = new Date().toISOString();
    await store.updateIncident(id, { updatedAt: nowIso, severity });
    if (severity !== fresh.severity) {
      await store.insertUpdate({
        id: randomUUID(),
        incidentId: id,
        kind: "severity_change",
        body: "Marked critical after multiple people confirmed it.",
        authorId: null,
        createdAt: nowIso,
      });
      await dispatchAlerts({ ...fresh, severity }, null);
    }
  }
  return added;
}

/** Community reports end after this many votes: at least the configured floor, or half the confirmers. */
function votesToResolve(rec: Pick<IncidentRecord, "confirmationCount">): number {
  return Math.max(config.limits.endedVotesToResolve, Math.ceil((rec.confirmationCount + 1) / 2));
}

export async function markEnded(id: string, user: UserRecord) {
  const store = getStore();
  const rec = await openIncident(id);
  if (effectiveStatus(rec) === "resolved") return false;
  rateLimit(`vote:${user.id}`, 60, HOUR);
  const added = await store.insertVote(id, user.id, "ended");
  if (!added) return false;
  const fresh = (await store.getIncident(id))!;
  const nowIso = new Date().toISOString();
  // Official feeds decide their own status; community votes only end user reports.
  const isCommunity = publicSource(fresh.sourceId).kind === "user";
  const resolve =
    isCommunity &&
    (fresh.reporterId === user.id ||
      fresh.endedCount >= votesToResolve(fresh));
  await store.insertUpdate({
    id: randomUUID(),
    incidentId: id,
    kind: "status_change",
    body: resolve ? "Marked as ended by the community." : "Someone nearby says this has ended.",
    authorId: user.id,
    createdAt: nowIso,
  });
  await store.updateIncident(id, resolve ? { status: "resolved", updatedAt: nowIso } : { updatedAt: nowIso });
  return true;
}

export async function addInfo(id: string, user: UserRecord, body: string) {
  const store = getStore();
  await openIncident(id);
  rateLimit(`info:${user.id}`, 10, HOUR);
  const mod = moderateText(body);
  if (!mod.ok) throw new ApiError(422, mod.reason, "moderation");
  if (!mod.text) throw new ApiError(400, "Add a few words first.", "validation");
  const nowIso = new Date().toISOString();
  await store.insertUpdate({
    id: randomUUID(),
    incidentId: id,
    kind: "info",
    body: mod.text,
    authorId: user.id,
    createdAt: nowIso,
  });
  await store.updateIncident(id, { updatedAt: nowIso });
  return { redacted: mod.redacted };
}

export async function flagIncident(id: string, user: UserRecord, reason: string) {
  const store = getStore();
  const rec = await openIncident(id);
  rateLimit(`flag:${user.id}`, 20, HOUR);
  const added = await store.insertFlag(id, user.id, reason);
  if (!added) return false;
  const fresh = (await store.getIncident(id))!;
  // Community reports are hidden for review once enough people flag them.
  if (publicSource(rec.sourceId).kind === "user" && fresh.flagCount >= config.limits.flagsToHide) {
    await store.updateIncident(id, { status: "under_review" });
  }
  return true;
}

export async function listMyReports(user: UserRecord, viewer: Viewer) {
  const store = getStore();
  const since = Date.now() - viewer.limits.historyHours * HOUR;
  const reports = await store.listReportsByUser(user.id, 50);
  const out: (PublicIncident & { merged: boolean; reportedAt: string })[] = [];
  const seen = new Set<string>();
  for (const r of reports) {
    if (seen.has(r.incidentId) || new Date(r.createdAt).getTime() < since) continue;
    seen.add(r.incidentId);
    const rec = await store.getIncident(r.incidentId);
    if (rec) out.push({ ...toPublic(rec), merged: r.merged, reportedAt: r.createdAt });
  }
  return out;
}
