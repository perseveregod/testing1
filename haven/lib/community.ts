// Community board: local events people can post, RSVP to and talk about.
// Shared by server and client. Deliberately not a chat: every conversation
// hangs off a specific event, posts are short, and 3 flags hide anything.

export type EventKind = "community_day" | "cleanup" | "meeting" | "market" | "sports" | "family" | "other";

export const EVENT_KINDS: { id: EventKind; label: string; plural: string; labelEs: string; pluralEs: string; color: string }[] = [
  { id: "community_day", label: "Community day", plural: "Community days", labelEs: "Día comunitario", pluralEs: "Días comunitarios", color: "#FF9F0A" },
  { id: "cleanup", label: "Cleanup", plural: "Cleanups", labelEs: "Limpieza", pluralEs: "Limpiezas", color: "#30D158" },
  { id: "meeting", label: "Meeting", plural: "Meetings", labelEs: "Reunión", pluralEs: "Reuniones", color: "#64D2FF" },
  { id: "market", label: "Market", plural: "Markets", labelEs: "Mercado", pluralEs: "Mercados", color: "#FFD60A" },
  { id: "sports", label: "Sports", plural: "Sports", labelEs: "Deportes", pluralEs: "Deportes", color: "#5E5CE6" },
  { id: "family", label: "Family", plural: "Family", labelEs: "Familia", pluralEs: "Familia", color: "#FF375F" },
  { id: "other", label: "Other", plural: "Other", labelEs: "Otro", pluralEs: "Otros", color: "#98989F" },
];

export const EVENT_KIND_IDS = EVENT_KINDS.map((k) => k.id) as [EventKind, ...EventKind[]];

export function eventKind(id: string) {
  return EVENT_KINDS.find((k) => k.id === id) ?? EVENT_KINDS[EVENT_KINDS.length - 1]!;
}

export const COMMUNITY_LIMITS = {
  title: 80,
  description: 500,
  placeName: 80,
  comment: 280,
  /** Distinct neighbors flagging something before it's hidden. */
  hideAtFlags: 3,
  eventsPerDay: 3,
  commentsPerHour: 10,
  commentsPerDay: 40,
  /** How far ahead an event can be posted. */
  maxDaysAhead: 60,
  /** Longest an event can run. */
  maxDurationHours: 16,
  /** Events without an end time stay listed this long after they start. */
  defaultDurationHours: 3,
};

/** Event as the app sees it. Exact coordinates are snapped to ~110 m. */
export interface CommunityEvent {
  id: string;
  kind: EventKind;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  placeName: string;
  latitude: number;
  longitude: number;
  goingCount: number;
  commentCount: number;
  isDemo: boolean;
  viewerGoing: boolean;
  mine: boolean;
}

export interface CommunityComment {
  id: string;
  /** Pseudonymous, stable per account; never the email or real name. */
  author: string;
  body: string;
  createdAt: string;
  mine: boolean;
  isDemo: boolean;
}

export interface CommunityEventDetail extends CommunityEvent {
  comments: CommunityComment[];
}

/** "Neighbor 4F2A": the same account always gets the same tag, and it reveals nothing. */
export function neighborName(userId: string | null): string {
  if (!userId) return "Neighbor";
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `Neighbor ${((h >>> 0) % 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

/** When an event drops off the board. */
export function eventEndsAt(e: { startsAt: string; endsAt: string | null }): number {
  return e.endsAt
    ? new Date(e.endsAt).getTime()
    : new Date(e.startsAt).getTime() + COMMUNITY_LIMITS.defaultDurationHours * 3_600_000;
}

export function isHappeningNow(e: { startsAt: string; endsAt: string | null }, now = Date.now()): boolean {
  return new Date(e.startsAt).getTime() <= now && now < eventEndsAt(e);
}
