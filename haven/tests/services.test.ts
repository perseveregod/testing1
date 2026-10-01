import { beforeEach, describe, expect, it, vi } from "vitest";

// Cookies only exist inside a real request; tests don't need them.
vi.mock("@/server/auth/session", async (orig) => ({ ...(await orig<typeof import("@/server/auth/session")>()), setSessionCookie: async () => {} }));
import { LocalStore } from "@/server/store/local";
import { setStoreForTests } from "@/server/store";
import type { UserRecord } from "@/server/store/types";
import { DEFAULT_ALERT_PREFS, inQuietHours, wantsIncident } from "@/server/services/alerts";
import { confirmIncident, createReport, flagIncident, getIncidentDetail, listIncidents, markEnded } from "@/server/services/incidents";
import { ingestAll } from "@/server/services/ingest";
import { limitsFor } from "@/lib/plans";
import type { IncidentRecord, Viewer } from "@/lib/types";
import { listQuerySchema } from "@/lib/validation";
import { config } from "@/server/config";

let store: LocalStore;
const P = { lat: 47.6097, lng: -122.3331 };
let ipN = 0;
const ip = () => `10.0.0.${++ipN}`;
const now = () => new Date().toISOString();

async function user(email: string | null = null): Promise<UserRecord> {
  return store.createUser({ email, displayName: "t" });
}
const viewer = (u: UserRecord, plan: "free" | "lifetime" = "free"): Viewer => ({
  id: u.id, email: u.email, displayName: "t", plan, limits: limitsFor(plan), createdAt: u.createdAt,
});
const report = (u: UserRecord, extra: Partial<{ category: IncidentRecord["category"]; description: string; lat: number; lng: number }> = {}) =>
  createReport(
    { category: extra.category ?? "fire", latitude: extra.lat ?? P.lat, longitude: extra.lng ?? P.lng, description: extra.description ?? "smoke visible" },
    u,
    ip(),
  );

beforeEach(() => {
  store = new LocalStore(null);
  setStoreForTests(store);
});

describe("reporting", () => {
  it("creates an incident with an approximate location and hides the reporter", async () => {
    const u = await user();
    const r = await report(u, { lat: 47.609712, lng: -122.333188 });
    expect(r.merged).toBe(false);
    const d = await getIncidentDetail(r.incidentId, null, null);
    expect(d.latitude).toBe(47.61);
    expect(d.unverified).toBe(true);
    expect(JSON.stringify(d)).not.toContain(u.id);
  });

  it("merges a nearby duplicate into the existing incident as a confirmation", async () => {
    const a = await user();
    const b = await user();
    const first = await report(a);
    const second = await report(b, { lat: P.lat + 0.001, description: "flames from roof" });
    expect(second).toMatchObject({ merged: true, incidentId: first.incidentId });
    const d = await getIncidentDetail(first.incidentId, viewer(b), null);
    expect(d.confirmationCount).toBe(1);
    expect(d.unverified).toBe(false);
    expect(d.viewer.confirmed).toBe(true);
    expect(d.updates.map((u) => u.kind)).toEqual(["created", "additional_report"]);
  });

  it("does not merge a different kind of event or a far-away one", async () => {
    const a = await user();
    const first = await report(a);
    expect((await report(await user(), { category: "medical" })).incidentId).not.toBe(first.incidentId);
    expect((await report(await user(), { lat: P.lat + 0.05 })).merged).toBe(false);
  });

  it("is idempotent on clientRequestId", async () => {
    const u = await user();
    const input = { category: "police" as const, latitude: P.lat, longitude: P.lng, description: "", clientRequestId: "abcdefgh-123" };
    const a = await createReport(input, u, ip());
    const b = await createReport(input, u, ip());
    expect(b.incidentId).toBe(a.incidentId);
    expect(await store.countReportsSince(u.id, "1970-01-01")).toBe(1);
  });

  it("rate limits a single account", async () => {
    const u = await user();
    for (let i = 0; i < 5; i++) await report(u, { lat: P.lat + i * 0.05 });
    await expect(report(u, { lat: P.lat + 0.5 })).rejects.toMatchObject({ status: 429 });
  });

  it("rejects abusive text and redacts personal info", async () => {
    const u = await user();
    await expect(report(u, { description: "i will kill him" })).rejects.toMatchObject({ status: 422 });
    const r = await report(u, { description: "call me 206 555 0100" });
    expect(r.redacted).toBe(true);
  });
});

describe("community actions", () => {
  it("prevents self-confirmation and double confirmation", async () => {
    const a = await user();
    const b = await user();
    const { incidentId } = await report(a);
    await expect(confirmIncident(incidentId, a)).rejects.toMatchObject({ status: 409 });
    expect(await confirmIncident(incidentId, b)).toBe(true);
    expect(await confirmIncident(incidentId, b)).toBe(false);
  });

  it("escalates a well-confirmed high-severity fire to critical", async () => {
    const a = await user();
    const { incidentId } = await report(a, { description: "structure fire spreading" });
    for (let i = 0; i < 3; i++) await confirmIncident(incidentId, await user());
    expect((await store.getIncident(incidentId))!.severity).toBe("critical");
  });

  it("resolves when the reporter marks it ended", async () => {
    const a = await user();
    const { incidentId } = await report(a);
    await markEnded(incidentId, a);
    expect((await store.getIncident(incidentId))!.status).toBe("resolved");
  });

  it("hides a community report after enough flags", async () => {
    const a = await user();
    const { incidentId } = await report(a);
    for (let i = 0; i < 3; i++) await flagIncident(incidentId, await user(), "false");
    await expect(getIncidentDetail(incidentId, null, null)).rejects.toMatchObject({ status: 404 });
    // The reporter can still see their own report.
    expect((await getIncidentDetail(incidentId, viewer(a), null)).status).toBe("under_review");
  });
});

describe("listing & plans", () => {
  it("ingests labeled demo data", async () => {
    await ingestAll(true);
    // Demo incidents are seeded around the demo center (downtown Houston).
    const c = config.sources.demoCenter;
    const q = listQuerySchema.parse({ lat: String(c.lat), lng: String(c.lng), radiusMi: "10" });
    const { items } = await listIncidents(q, null);
    expect(items.length).toBeGreaterThan(10);
    expect(items.every((i) => i.isDemo && i.source.kind === "demo")).toBe(true);
  });

  it("limits history and advanced filters for free accounts", async () => {
    const u = await user();
    const q = listQuerySchema.parse({ lat: String(P.lat), lng: String(P.lng), sinceHours: "720" });
    expect((await listIncidents(q, viewer(u))).sinceHours).toBe(24);
    expect((await listIncidents(q, viewer(u, "lifetime"))).sinceHours).toBe(720);
    const adv = listQuerySchema.parse({ lat: String(P.lat), lng: String(P.lng), verifiedOnly: "1" });
    await expect(listIncidents(adv, viewer(u))).rejects.toMatchObject({ status: 403 });
  });
});

describe("alerts", () => {
  it("notifies people with a saved place nearby, but not the reporter or far-away places", async () => {
    const reporter = await user();
    const near = await user();
    const far = await user();
    const now = new Date().toISOString();
    await store.insertPlace(near.id, { id: "p1", kind: "home", label: "Home", latitude: P.lat + 0.01, longitude: P.lng, address: "", alertsEnabled: true, radiusMi: null, categories: null, createdAt: now });
    await store.insertPlace(far.id, { id: "p2", kind: "home", label: "Home", latitude: P.lat + 0.5, longitude: P.lng, address: "", alertsEnabled: true, radiusMi: null, categories: null, createdAt: now });
    await store.insertPlace(reporter.id, { id: "p3", kind: "home", label: "Home", latitude: P.lat, longitude: P.lng, address: "", alertsEnabled: true, radiusMi: null, categories: null, createdAt: now });
    await report(reporter);
    expect(await store.listNotifications(near.id, 10)).toHaveLength(1);
    expect((await store.listNotifications(near.id, 10))[0]!.body).toMatch(/from Home/);
    expect(await store.listNotifications(far.id, 10)).toHaveLength(0);
    expect(await store.listNotifications(reporter.id, 10)).toHaveLength(0);
  });

  it("clamps free accounts to their radius", async () => {
    const reporter = await user();
    const listener = await user();
    // 10 miles away; listener asked for 25 but is on the free plan (max 5).
    await store.saveAlertPrefs(listener.id, { ...DEFAULT_ALERT_PREFS, radiusMi: 25 });
    await store.insertPlace(listener.id, { id: "p", kind: "work", label: "Work", latitude: P.lat + 0.145, longitude: P.lng, address: "", alertsEnabled: true, radiusMi: null, categories: null, createdAt: new Date().toISOString() });
    await report(reporter);
    expect(await store.listNotifications(listener.id, 10)).toHaveLength(0);
  });

  it("respects categories, critical-only and quiet hours", () => {
    const inc = { category: "fire", severity: "high" } as IncidentRecord;
    const now = new Date("2026-10-01T06:30:00Z"); // 23:30 in Los Angeles
    expect(wantsIncident({ ...DEFAULT_ALERT_PREFS, categories: ["medical"] }, inc, now)).toBe(false);
    expect(wantsIncident({ ...DEFAULT_ALERT_PREFS, criticalOnly: true }, inc, now)).toBe(false);
    const quiet = { ...DEFAULT_ALERT_PREFS, quietHoursStart: "22:00", quietHoursEnd: "07:00", timeZone: "America/Los_Angeles" };
    expect(inQuietHours(quiet, now)).toBe(true);
    expect(wantsIncident(quiet, inc, now)).toBe(false);
    expect(wantsIncident(quiet, { ...inc, severity: "critical" }, now)).toBe(true);
  });
});

describe("lifetime value", () => {
  it("applies a saved place's own radius and categories for Lifetime accounts", async () => {
    const { PLAN_LIMITS } = await import("@/lib/plans");
    const reporter = await user();
    const lifetime = await user("l@x.co");
    await store.grantEntitlement({ userId: lifetime.id, plan: "lifetime", source: "test", externalRef: "t1", amountCents: 1000, currency: "usd", grantedAt: new Date().toISOString() });
    // Account-wide: 1 mile, all categories. Place: 10 miles, fire only.
    await store.saveAlertPrefs(lifetime.id, { ...DEFAULT_ALERT_PREFS, radiusMi: 1 });
    await store.insertPlace(lifetime.id, { id: "p", kind: "work", label: "Work", latitude: P.lat + 0.1, longitude: P.lng, address: "", alertsEnabled: true, radiusMi: 10, categories: ["fire"], createdAt: now() });
    await report(reporter, { category: "medical" });
    expect(await store.listNotifications(lifetime.id, 10)).toHaveLength(0);
    await report(await user(), { category: "fire", lat: P.lat + 0.02 });
    expect(await store.listNotifications(lifetime.id, 10)).toHaveLength(1);
    expect(PLAN_LIMITS.lifetime.historyHours).toBe(24 * 90);
  });

  it("ignores per-place rules on free accounts", async () => {
    const reporter = await user();
    const free = await user();
    await store.saveAlertPrefs(free.id, { ...DEFAULT_ALERT_PREFS, radiusMi: 1 });
    await store.insertPlace(free.id, { id: "p", kind: "work", label: "Work", latitude: P.lat + 0.1, longitude: P.lng, address: "", alertsEnabled: true, radiusMi: 25, categories: null, createdAt: now() });
    await report(reporter);
    expect(await store.listNotifications(free.id, 10)).toHaveLength(0);
  });

  it("summarizes real incidents and excludes demo data from insights", async () => {
    const { areaInsights } = await import("@/server/services/insights");
    await ingestAll(true);
    const a = await user();
    await report(a, { category: "fire" });
    await report(await user(), { category: "medical", lat: P.lat + 0.03 });
    const ins = await areaInsights(P, 3, viewer(a, "lifetime"));
    expect(ins.days).toBe(30);
    expect(ins.total).toBe(2);
    expect(ins.byCategory.map((c) => c.category).sort()).toEqual(["fire", "medical"]);
    expect(ins.byDay).toHaveLength(30);
    expect(ins.byDay.at(-1)!.count).toBe(2);
    expect((await areaInsights(P, 3, viewer(a))).days).toBe(7);
  });
});

describe("demo incident ids", () => {
  it("are the same on every server instance", async () => {
    const { stableIncidentId } = await import("@/server/services/ingest");
    const a = stableIncidentId("demo", "demo-3");
    expect(a).toBe(stableIncidentId("demo", "demo-3"));
    expect(a).not.toBe(stableIncidentId("demo", "demo-4"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("let a fresh store find a demo incident listed by another", async () => {
    await ingestAll(true);
    const c = config.sources.demoCenter;
    const { items } = await listIncidents(listQuerySchema.parse({ lat: String(c.lat), lng: String(c.lng), radiusMi: "10" }), null);
    const id = items[0].id;
    // Simulate a second Vercel instance with its own empty store.
    store = new LocalStore(null);
    setStoreForTests(store);
    await ingestAll(true);
    expect((await getIncidentDetail(id, null, null)).id).toBe(id);
  });
});

describe("demo email sign-in", () => {
  it("issues a code that verifies on any instance and rejects wrong codes", async () => {
    const { startEmailSignIn, verifyEmailSignIn } = await import("@/server/auth/email");
    const { devCode } = await startEmailSignIn("test@example.com", ip());
    expect(devCode).toMatch(/^\d{6}$/);
    // Same code from a "different server" (a fresh start call) within the window.
    expect((await startEmailSignIn("test@example.com", ip())).devCode).toBe(devCode);
    await expect(verifyEmailSignIn("test@example.com", "000000" === devCode ? "111111" : "000000", null, ip())).rejects.toMatchObject({ status: 400 });
    const u = await verifyEmailSignIn("test@example.com", devCode!, null, ip());
    expect(u.email).toBe("test@example.com");
  });
});
