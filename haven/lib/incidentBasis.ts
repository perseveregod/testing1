import { getCategory } from "./categories";
import type { Key } from "./i18n";
import type { PublicIncident, StatusBasis } from "./types";

// What "Active", "Ended" and a severity actually rest on, in terms the app can
// show next to them. Three kinds of information are kept apart: what an
// official source said, what a person reported, and what Haven worked out.

/**
 * A feed that publishes its own active list ends its incidents itself. Haven
 * only times those out after a day, as a backstop if the feed stops being read.
 */
export const LISTED_BACKSTOP_HOURS = 24;

type Explainable = Pick<PublicIncident, "source" | "status" | "isDemo" | "category"> & { statusBasis?: StatusBasis };

export type Origin = "official" | "community" | "demo";

export function originOf(i: Pick<PublicIncident, "source" | "isDemo">): Origin {
  if (i.isDemo) return "demo";
  return i.source.kind === "user" ? "community" : "official";
}

export function basisOf(i: Explainable): StatusBasis {
  if (i.statusBasis) return i.statusBasis;
  // Data cached before the server sent a basis: what the source and status imply.
  if (i.status === "under_review") return "review";
  const community = i.source.kind === "user";
  if (i.status === "resolved") return community ? "community_ended" : "source_ended";
  return community ? "community_open" : "source_listed";
}

/** Hours with no activity after which Haven assumes an incident is over. */
export function quietHoursFor(i: Pick<PublicIncident, "source" | "isDemo" | "category">): number {
  const hours = getCategory(i.category).staleAfterHours;
  return originOf(i) === "official" ? Math.max(hours, LISTED_BACKSTOP_HOURS) : hours;
}

/** The sentence that says what the status rests on. */
export function statusMeaning(i: Explainable): { key: Key; vars?: Record<string, string | number> } {
  if (i.isDemo) return { key: "why.demo" };
  const basis = basisOf(i);
  if (basis === "community_open" || basis === "aged_out") return { key: `why.${basis}`, vars: { h: quietHoursFor(i) } };
  return { key: `why.${basis}` };
}

/** Who decided the severity: the source's own rating, or Haven's estimate. */
export function severityMeaning(i: Pick<PublicIncident, "source" | "isDemo">): Key {
  const origin = originOf(i);
  if (origin === "demo") return "why.demo";
  if (origin === "community") return "sev.why.community";
  return i.source.severityBy === "source" ? "sev.why.source" : "sev.why.estimated";
}
