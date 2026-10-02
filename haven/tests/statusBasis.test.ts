import { describe, expect, it } from "vitest";
import { effectiveStatus, statusBasis } from "@/server/services/incidents";
import type { IncidentRecord } from "@/lib/types";

// "Active" and "Ended" have to mean what the app says they mean.

const NOW = Date.parse("2026-10-02T18:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

function rec(extra: Partial<IncidentRecord>): IncidentRecord {
  return {
    id: "i1", category: "fire", title: "Building fire", description: "", latitude: 29.76, longitude: -95.37,
    approximateAddress: "", severity: "high", status: "active", sourceId: "houston_active", externalId: "x",
    reporterId: null, createdAt: hoursAgo(5), updatedAt: hoursAgo(5), confirmationCount: 0, endedCount: 0,
    flagCount: 0, mergedIntoId: null, storm: null,
    ...extra,
  } as IncidentRecord;
}

describe("official feeds that publish their own active list", () => {
  it("stay active while the feed still lists them, however long the call runs", () => {
    // A fire the city has listed for 5 hours used to read as ended after 3.
    const r = rec({});
    expect(effectiveStatus(r, NOW)).toBe("active");
    expect(statusBasis(r, NOW)).toBe("source_listed");
  });

  it("end when the feed stops listing them", () => {
    const r = rec({ status: "resolved", updatedAt: hoursAgo(1) });
    expect(effectiveStatus(r, NOW)).toBe("resolved");
    expect(statusBasis(r, NOW)).toBe("source_ended");
  });

  it("age out after a day as a backstop, and say that it was an assumption", () => {
    const r = rec({ createdAt: hoursAgo(30), updatedAt: hoursAgo(30) });
    expect(effectiveStatus(r, NOW)).toBe("resolved");
    expect(statusBasis(r, NOW)).toBe("aged_out");
  });
});

describe("community reports", () => {
  it("are open until marked over", () => {
    const r = rec({ sourceId: "user", externalId: null, createdAt: hoursAgo(1), updatedAt: hoursAgo(1) });
    expect(statusBasis(r, NOW)).toBe("community_open");
    expect(statusBasis({ ...r, status: "resolved" }, NOW)).toBe("community_ended");
  });

  it("age out after the category's quiet period, which is Haven's assumption", () => {
    const r = rec({ sourceId: "user", externalId: null });
    expect(effectiveStatus(r, NOW)).toBe("resolved");
    expect(statusBasis(r, NOW)).toBe("aged_out");
  });

  it("under review is its own state", () => {
    expect(statusBasis(rec({ sourceId: "user", status: "under_review" }), NOW)).toBe("review");
  });
});

import { basisOf, originOf, quietHoursFor, severityMeaning, statusMeaning } from "@/lib/incidentBasis";
import { t } from "@/lib/i18n";
import type { PublicIncident } from "@/lib/types";

const houston = { id: "houston_active", name: "Houston", kind: "open_data", attribution: "", severityBy: "haven" } as PublicIncident["source"];
const nws = { id: "nws_alerts", name: "NWS", kind: "weather", attribution: "", severityBy: "source" } as PublicIncident["source"];
const person = { id: "user", name: "Community report", kind: "user", attribution: "" } as PublicIncident["source"];
const pub = (extra: Partial<PublicIncident>) => ({ source: houston, status: "active", isDemo: false, category: "fire", ...extra }) as PublicIncident;

describe("what the app says a status and severity rest on", () => {
  it("keeps official, community and demo apart", () => {
    expect(originOf(pub({}))).toBe("official");
    expect(originOf(pub({ source: person }))).toBe("community");
    expect(originOf(pub({ isDemo: true }))).toBe("demo");
  });

  it("never calls an ended official incident safe, and says who ended it", () => {
    const m = statusMeaning(pub({ status: "resolved", statusBasis: "source_ended" }));
    expect(m.key).toBe("why.source_ended");
    expect(t("en", m.key)).toMatch(/doesn't mean the area is safe/);
  });

  it("says an aged-out report is Haven's assumption, with the real number of hours", () => {
    const m = statusMeaning(pub({ source: person, status: "resolved", statusBasis: "aged_out", category: "fire" }));
    expect(m).toEqual({ key: "why.aged_out", vars: { h: quietHoursFor(pub({ source: person })) } });
    expect(t("en", m.key, m.vars)).toMatch(/Haven assumes it's over\. Nobody confirmed that/);
  });

  it("says whose severity it is", () => {
    expect(severityMeaning(pub({}))).toBe("sev.why.estimated");
    expect(severityMeaning(pub({ source: nws }))).toBe("sev.why.source");
    expect(severityMeaning(pub({ source: person }))).toBe("sev.why.community");
    expect(severityMeaning(pub({ isDemo: true }))).toBe("why.demo");
  });

  it("works on data cached before the server sent a basis", () => {
    expect(basisOf(pub({}))).toBe("source_listed");
    expect(basisOf(pub({ source: person, status: "resolved" }))).toBe("community_ended");
  });

  it("official incidents are only timed out after a day", () => {
    expect(quietHoursFor(pub({ category: "fire" }))).toBe(24);
  });
});
