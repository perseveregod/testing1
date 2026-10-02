import { randomUUID } from "node:crypto";
import {
  COMMUNITY_LIMITS,
  eventEndsAt,
  neighborName,
  type CommunityComment,
  type CommunityEvent,
  type CommunityEventDetail,
  type EventKind,
} from "@/lib/community";
import { approximate, METERS_PER_MILE } from "@/lib/geo";
import { moderateText } from "@/lib/moderation";
import { config } from "../config";
import { ApiError, rateLimit } from "../http";
import { getStore } from "../store";
import type { EventCommentRecord, EventRecord, UserRecord } from "../store/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------------
// Reading

function toPublicEvent(e: EventRecord, user: UserRecord | null, going: Set<string>): CommunityEvent {
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    placeName: e.placeName,
    latitude: e.latitude,
    longitude: e.longitude,
    goingCount: e.goingCount,
    commentCount: e.commentCount,
    isDemo: e.isDemo,
    viewerGoing: going.has(e.id),
    mine: Boolean(user && e.createdBy === user.id),
  };
}

function toPublicComment(c: EventCommentRecord, user: UserRecord | null): CommunityComment {
  return {
    id: c.id,
    // Demo comments have no account; vary their names by comment id.
    author: neighborName(c.userId ?? c.id),
    body: c.body,
    createdAt: c.createdAt,
    mine: Boolean(user && c.userId === user.id),
    isDemo: c.isDemo,
  };
}

export async function listCommunityEvents(
  q: { lat: number; lng: number; radiusMi: number; days: number },
  user: UserRecord | null,
): Promise<CommunityEvent[]> {
  await ensureCommunitySeeded();
  const now = Date.now();
  const events = await getStore().listEvents({
    center: { lat: q.lat, lng: q.lng },
    radiusM: q.radiusMi * METERS_PER_MILE,
    endsAfter: new Date(now).toISOString(),
    startsBefore: new Date(now + q.days * DAY).toISOString(),
    limit: 100,
  });
  const going = user ? await getStore().goingEventIds(user.id, events.map((e) => e.id)) : new Set<string>();
  return events.map((e) => toPublicEvent(e, user, going));
}

async function visibleEvent(id: string): Promise<EventRecord> {
  await ensureCommunitySeeded();
  const e = await getStore().getEvent(id);
  if (!e || e.hidden) throw new ApiError(404, "This event isn't available anymore.", "not_found");
  return e;
}

export async function getCommunityEvent(id: string, user: UserRecord | null): Promise<CommunityEventDetail> {
  const e = await visibleEvent(id);
  const [comments, going] = await Promise.all([
    getStore().listEventComments(e.id, 100),
    user ? getStore().goingEventIds(user.id, [e.id]) : Promise.resolve(new Set<string>()),
  ]);
  return { ...toPublicEvent(e, user, going), comments: comments.map((c) => toPublicComment(c, user)) };
}

// ---------------------------------------------------------------------------
// Writing. Same safety model as incident reports: per-account limits from the
// database, a per-IP burst limit, server-side moderation, snapped locations.

function moderated(text: string, max: number, field: string): string {
  const mod = moderateText(text, max);
  if (!mod.ok) throw new ApiError(422, mod.reason, "moderation");
  if (field !== "description" && !mod.text) throw new ApiError(422, `The ${field} can't be empty.`, "validation");
  return mod.text;
}

export interface CreateEventInput {
  kind: EventKind;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  placeName: string;
  latitude: number;
  longitude: number;
  clientRequestId?: string;
}

export async function createCommunityEvent(input: CreateEventInput, user: UserRecord, ip: string): Promise<CommunityEvent> {
  const store = getStore();
  if (!user.email) {
    throw new ApiError(403, "Sign in with your email to post an event. It keeps the board free of spam.", "email_required");
  }
  const id = input.clientRequestId ? `evt-${input.clientRequestId}` : `evt-${randomUUID()}`;
  if (input.clientRequestId) {
    const prior = await store.getEvent(id);
    if (prior && prior.createdBy === user.id) return toPublicEvent(prior, user, new Set());
  }

  rateLimit(`event-ip:${ip}`, COMMUNITY_LIMITS.eventsPerDay * 2, HOUR);
  const now = Date.now();
  if ((await store.countEventsSince(user.id, new Date(now - DAY).toISOString())) >= COMMUNITY_LIMITS.eventsPerDay) {
    throw new ApiError(429, "You've posted a few events today. Try again tomorrow.", "rate_limited");
  }

  const start = Date.parse(input.startsAt);
  const end = input.endsAt ? Date.parse(input.endsAt) : null;
  if (start < now - HOUR) throw new ApiError(422, "That start time has already passed.", "validation");
  if (start > now + COMMUNITY_LIMITS.maxDaysAhead * DAY) {
    throw new ApiError(422, `Events can be posted up to ${COMMUNITY_LIMITS.maxDaysAhead} days ahead.`, "validation");
  }
  if (end != null && (end <= start || end > start + COMMUNITY_LIMITS.maxDurationHours * HOUR)) {
    throw new ApiError(422, "The end time needs to be after the start, on the same day.", "validation");
  }

  // A block party might be at someone's home: never store the exact point.
  const point = approximate({ lat: input.latitude, lng: input.longitude }, 3);
  const rec: EventRecord = {
    id,
    kind: input.kind,
    title: moderated(input.title, COMMUNITY_LIMITS.title, "name"),
    description: moderated(input.description, COMMUNITY_LIMITS.description, "description"),
    startsAt: new Date(start).toISOString(),
    endsAt: end != null ? new Date(end).toISOString() : null,
    placeName: moderated(input.placeName, COMMUNITY_LIMITS.placeName, "place"),
    latitude: point.lat,
    longitude: point.lng,
    createdBy: user.id,
    createdAt: new Date(now).toISOString(),
    goingCount: 0,
    commentCount: 0,
    flagCount: 0,
    hidden: false,
    isDemo: false,
  };
  await store.insertEvent(rec);
  // Whoever posts it is going.
  await store.setGoing(rec.id, user.id, true);
  return toPublicEvent({ ...rec, goingCount: 1 }, user, new Set([rec.id]));
}

export async function setCommunityGoing(eventId: string, going: boolean, user: UserRecord) {
  rateLimit(`going:${user.id}`, 60, HOUR);
  const e = await visibleEvent(eventId);
  if (eventEndsAt(e) < Date.now()) throw new ApiError(409, "This event has already ended.", "ended");
  await getStore().setGoing(e.id, user.id, going);
  const fresh = await getStore().getEvent(e.id);
  return { going, goingCount: fresh?.goingCount ?? e.goingCount };
}

export async function addCommunityComment(
  eventId: string,
  input: { body: string; clientRequestId?: string },
  user: UserRecord,
  ip: string,
): Promise<CommunityComment> {
  const store = getStore();
  const id = input.clientRequestId ? `cmt-${input.clientRequestId}` : `cmt-${randomUUID()}`;
  if (input.clientRequestId) {
    const prior = await store.getEventComment(id);
    if (prior && prior.userId === user.id) return toPublicComment(prior, user);
  }
  const e = await visibleEvent(eventId);
  if (eventEndsAt(e) < Date.now() - 7 * DAY) throw new ApiError(409, "Comments are closed for this event.", "ended");

  rateLimit(`comment-ip:${ip}`, COMMUNITY_LIMITS.commentsPerHour * 2, HOUR);
  const now = Date.now();
  const [lastHour, lastDay] = await Promise.all([
    store.countEventCommentsSince(user.id, new Date(now - HOUR).toISOString()),
    store.countEventCommentsSince(user.id, new Date(now - DAY).toISOString()),
  ]);
  if (lastHour >= COMMUNITY_LIMITS.commentsPerHour || lastDay >= COMMUNITY_LIMITS.commentsPerDay) {
    throw new ApiError(429, "You've commented a lot recently. Take a break and try again later.", "rate_limited");
  }

  const rec: EventCommentRecord = {
    id,
    eventId: e.id,
    userId: user.id,
    body: moderated(input.body, COMMUNITY_LIMITS.comment, "comment"),
    createdAt: new Date(now).toISOString(),
    flagCount: 0,
    hidden: false,
    isDemo: false,
  };
  await store.insertEventComment(rec);
  return toPublicComment(rec, user);
}

/**
 * Report something, or remove your own post. Anything reported by
 * `hideAtFlags` different people is hidden for everyone.
 */
export async function flagCommunityItem(kind: "event" | "comment", id: string, user: UserRecord) {
  rateLimit(`community-flag:${user.id}`, 30, HOUR);
  const store = getStore();
  const target = kind === "event" ? await store.getEvent(id) : await store.getEventComment(id);
  if (!target || target.hidden) return { hidden: true, removed: false };
  const owner = kind === "event" ? (target as EventRecord).createdBy : (target as EventCommentRecord).userId;
  if (owner && owner === user.id) {
    await (kind === "event" ? store.hideEvent(id) : store.hideEventComment(id));
    return { hidden: true, removed: true };
  }
  const count = await store.flagCommunityItem(kind, id, user.id);
  const hide = count >= COMMUNITY_LIMITS.hideAtFlags;
  if (hide) await (kind === "event" ? store.hideEvent(id) : store.hideEventComment(id));
  return { hidden: hide, removed: false };
}

// ---------------------------------------------------------------------------
// Demo board. Fictional events at real Houston public places, always labeled
// as demo. Each seed recurs weekly, so the board always has the next 7 days.

interface Seed {
  slug: string;
  kind: EventKind;
  title: string;
  description: string;
  placeName: string;
  lat: number;
  lng: number;
  /** 0 = Sunday. */
  weekday: number;
  start: [number, number];
  hours: number;
  going: number;
  comments: string[];
}

export const COMMUNITY_SEEDS: Seed[] = [
  {
    slug: "northside-day",
    kind: "community_day",
    title: "Northside Community Day",
    description: "Free food, live music, school supplies and a bounce house for the kids. Bring the whole family.",
    placeName: "Moody Park",
    lat: 29.7943,
    lng: -95.3622,
    weekday: 6,
    start: [11, 0],
    hours: 4,
    going: 48,
    comments: ["Is there parking nearby?", "Lot by the rec center was open last time, plus street parking on Fulton.", "We'll bring our church choir!"],
  },
  {
    slug: "independence-heights-block-party",
    kind: "community_day",
    title: "Independence Heights block party",
    description: "Neighbors, grills and dominoes. Bring a chair and a side dish if you can.",
    placeName: "Independence Heights Park",
    lat: 29.815,
    lng: -95.401,
    weekday: 6,
    start: [14, 0],
    hours: 4,
    going: 36,
    comments: ["Can we bring the kids' bikes?", "Yes, the side street is closed off."],
  },
  {
    slug: "acres-homes-meeting",
    kind: "meeting",
    title: "Acres Homes neighborhood meeting",
    description: "Street lights, drainage on our blocks and youth programs. Open to all residents, English and Spanish.",
    placeName: "Acres Homes Multi-Service Center",
    lat: 29.8605,
    lng: -95.4319,
    weekday: 2,
    start: [18, 30],
    hours: 1.5,
    going: 17,
    comments: ["Please ask about the ditch on our street, it flooded again.", "Adding it to the agenda."],
  },
  {
    slug: "bayou-cleanup",
    kind: "cleanup",
    title: "Bayou cleanup morning",
    description: "Gloves, grabbers and bags provided. Wear closed shoes and bring water.",
    placeName: "White Oak Bayou Trail at Heights Blvd",
    lat: 29.7752,
    lng: -95.3964,
    weekday: 6,
    start: [8, 30],
    hours: 2.5,
    going: 22,
    comments: ["Good for teens who need volunteer hours?", "Yes, we sign forms at the end."],
  },
  {
    slug: "east-end-market",
    kind: "market",
    title: "East End farmers market",
    description: "Local produce, tamales, plants and crafts. Most stands take cash and cards.",
    placeName: "Navigation Esplanade",
    lat: 29.7536,
    lng: -95.3417,
    weekday: 0,
    start: [10, 0],
    hours: 4,
    going: 31,
    comments: ["The pan dulce stand sells out by 11!"],
  },
  {
    slug: "emancipation-soccer",
    kind: "sports",
    title: "Pickup soccer, all levels",
    description: "Friendly 7v7. Bring a light and a dark shirt. All ages 14+.",
    placeName: "Emancipation Park",
    lat: 29.7334,
    lng: -95.3607,
    weekday: 0,
    start: [17, 0],
    hours: 2,
    going: 14,
    comments: ["Is it on if it rains?", "Light rain yes, storms no. Check back here."],
  },
  {
    slug: "discovery-movie",
    kind: "family",
    title: "Family movie night in the park",
    description: "Animated movie on the lawn. Bring blankets. Snacks for sale.",
    placeName: "Discovery Green",
    lat: 29.7536,
    lng: -95.3593,
    weekday: 5,
    start: [19, 30],
    hours: 2,
    going: 63,
    comments: [],
  },
  {
    slug: "alief-trunk-or-treat",
    kind: "family",
    title: "Trunk-or-treat",
    description: "Costumes welcome. Decorated cars, candy and a costume parade for little ones.",
    placeName: "Alief Park",
    lat: 29.6945,
    lng: -95.5967,
    weekday: 5,
    start: [18, 0],
    hours: 2.5,
    going: 85,
    comments: ["Can we sign up a car to hand out candy?", "Yes! Show up 30 minutes early."],
  },
  {
    slug: "gulfton-storm-prep",
    kind: "meeting",
    title: "Storm prep workshop (English / Español)",
    description: "Build a go-bag, sign up for alerts and learn where to get sandbags. Taller en español.",
    placeName: "Gulfton community center",
    lat: 29.7275,
    lng: -95.4723,
    weekday: 3,
    start: [18, 0],
    hours: 1.5,
    going: 19,
    comments: ["¿Habrá cuidado de niños?", "Sí, hay un cuarto para niños."],
  },
  {
    slug: "bike-tuneups",
    kind: "other",
    title: "Free bike tune-ups",
    description: "Volunteers check brakes, tires and chains. First come, first served.",
    placeName: "Near Northside, Burnett Transit Center plaza",
    lat: 29.7713,
    lng: -95.3591,
    weekday: 4,
    start: [17, 30],
    hours: 2,
    going: 11,
    comments: [],
  },
];

const CHICAGO = "America/Chicago";

function chicagoOffsetMinutes(at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: CHICAGO, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-6";
  const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return -360;
  const h = Number(m[1]);
  return h * 60 + Math.sign(h) * Number(m[2] ?? 0);
}

function chicagoDay(at: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), weekday };
}

/** The next time (Houston local) this seed is on, or the current one if it's still running. */
export function nextOccurrence(seed: Pick<Seed, "weekday" | "start" | "hours">, now: number): Date {
  for (let k = 0; k < 8; k++) {
    const day = chicagoDay(new Date(now + k * DAY));
    if (day.weekday !== seed.weekday) continue;
    const naive = Date.UTC(day.y, day.m - 1, day.d, seed.start[0], seed.start[1]);
    const start = naive - chicagoOffsetMinutes(new Date(naive)) * 60_000;
    if (start + seed.hours * HOUR > now) return new Date(start);
  }
  return new Date(now + 7 * DAY);
}

let seededAt = 0;

/** Keeps the next week of demo events on the board. Cheap: inserts are idempotent. */
export async function ensureCommunitySeeded(force = false) {
  if (!config.sources.enabled.includes("demo")) return;
  const now = Date.now();
  if (!force && now - seededAt < 10 * 60_000) return;
  seededAt = now;
  const store = getStore();
  try {
    const events = COMMUNITY_SEEDS.map((s): EventRecord => {
      const start = nextOccurrence(s, now);
      const stamp = start.toISOString().slice(0, 10).replace(/-/g, "");
      return {
        id: `demo-${s.slug}-${stamp}`,
        kind: s.kind,
        title: s.title,
        description: s.description,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + s.hours * HOUR).toISOString(),
        placeName: s.placeName,
        latitude: s.lat,
        longitude: s.lng,
        createdBy: null,
        createdAt: new Date(Math.min(now, start.getTime()) - 3 * DAY).toISOString(),
        goingCount: s.going,
        commentCount: 0,
        flagCount: 0,
        hidden: false,
        isDemo: true,
      };
    });
    await Promise.all(events.map((e) => store.insertEvent(e)));
    await Promise.all(
      COMMUNITY_SEEDS.flatMap((s, i) =>
        s.comments.map((body, n) =>
          store.insertEventComment({
            id: `${events[i]!.id}-c${n}`,
            eventId: events[i]!.id,
            userId: null,
            body,
            createdAt: new Date(now - (s.comments.length - n) * 47 * 60_000).toISOString(),
            flagCount: 0,
            hidden: false,
            isDemo: true,
          }),
        ),
      ),
    );
  } catch (err) {
    // Missing tables surface as a clear error on the read itself.
    seededAt = 0;
    if (!(err instanceof ApiError)) console.error("[haven] community seed failed", err);
  }
}

/** Tests only. */
export function resetCommunitySeedForTests() {
  seededAt = 0;
}
