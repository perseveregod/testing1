import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStore } from "@/server/store/local";
import { setStoreForTests } from "@/server/store";
import { confirmIncident, createReport, getIncidentDetail, listIncidents } from "@/server/services/incidents";
import { ingestAll } from "@/server/services/ingest";
import { isValidStorm, stormFade, strings, stormTitle } from "@/lib/storm";
import { listQuerySchema } from "@/lib/validation";
import { config } from "@/server/config";

vi.mock("@/server/auth/session", async (orig) => ({ ...(await orig<typeof import("@/server/auth/session")>()), setSessionCookie: async () => {} }));

let store: LocalStore;
let n = 0;
const ip = () => `10.9.0.${++n}`;
const user = () => store.createUser({ email: null, displayName: "t" });
const P = { lat: 29.7604, lng: -95.3698 };

beforeEach(() => {
  store = new LocalStore(null);
  setStoreForTests(store);
});

const storm = (state: "out" | "on" | "flooded" | "passable" | "open" | "closed", placeType: null | "gas" = null) => ({ state, placeType });

describe("storm rules", () => {
  it("validates state pairs and place types", () => {
    expect(isValidStorm("power", storm("out"))).toBe(true);
    expect(isValidStorm("power", storm("flooded"))).toBe(false);
    expect(isValidStorm("place", storm("open"))).toBe(false);
    expect(isValidStorm("place", storm("open", "gas"))).toBe(true);
    expect(isValidStorm("fire", null)).toBe(true);
  });

  it("fades: full for 2h, faded until 6h, then hidden", () => {
    const now = Date.now();
    const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
    expect(stormFade(ago(1), now)).toBe(1);
    expect(stormFade(ago(4), now)).toBeLessThan(1);
    expect(stormFade(ago(4), now)).toBeGreaterThan(0);
    expect(stormFade(ago(6.5), now)).toBe(0);
  });

  it("has Spanish for every English label", () => {
    expect(Object.keys(strings("es")).sort()).toEqual(Object.keys(strings("en")).sort());
    expect(stormTitle(storm("open", "gas"), "es")).toBe("Gasolinera · Abierto");
  });
});

describe("storm reports", () => {
  it("snaps to the block, confirms the same state and overrides a different one", async () => {
    const a = await user();
    const b = await user();
    const out = await createReport({ category: "power", latitude: 29.76012, longitude: -95.36981, description: "", storm: storm("out") }, a, ip());
    const rec = await store.getIncident(out.incidentId);
    expect(rec!.latitude).toBe(29.76); // never the exact tap
    expect(rec!.longitude).toBe(-95.37);
    expect(rec!.storm).toEqual(storm("out"));

    // Same block, same state: a confirmation, not a second pin.
    const again = await createReport({ category: "power", latitude: P.lat, longitude: P.lng, description: "", storm: storm("out") }, b, ip());
    expect(again).toMatchObject({ incidentId: out.incidentId, merged: true });

    // Same block, power back on: replaces the old report.
    const on = await createReport({ category: "power", latitude: P.lat, longitude: P.lng, description: "", storm: storm("on") }, b, ip());
    expect(on.incidentId).not.toBe(out.incidentId);
    const q = listQuerySchema.parse({ lat: String(P.lat), lng: String(P.lng), radiusMi: "2", categories: "power,flooding,place" });
    const { items } = await listIncidents(q, null);
    expect(items.map((i) => i.storm?.state)).toEqual(["on"]);
  });

  it("stays out of the normal map and shows only in Storm Mode", async () => {
    const a = await user();
    await createReport({ category: "flooding", latitude: P.lat, longitude: P.lng, description: "", storm: storm("flooded") }, a, ip());
    const normal = await listIncidents(listQuerySchema.parse({ lat: String(P.lat), lng: String(P.lng), radiusMi: "2" }), null);
    expect(normal.items.some((i) => i.category === "flooding")).toBe(false);
    const stormList = await listIncidents(listQuerySchema.parse({ lat: String(P.lat), lng: String(P.lng), radiusMi: "2", categories: "flooding" }), null);
    expect(stormList.items[0]).toMatchObject({ severity: "critical", storm: { state: "flooded" } });
  });

  it("keeps an optional photo out of lists but returns it on the detail", async () => {
    const a = await user();
    const photo = "data:image/jpeg;base64,/9j/4AAQ";
    const r = await createReport({ category: "place", latitude: P.lat, longitude: P.lng, description: "Open", storm: storm("open", "gas"), photo }, a, ip());
    const { items } = await listIncidents(listQuerySchema.parse({ lat: String(P.lat), lng: String(P.lng), radiusMi: "2", categories: "place" }), null);
    expect(items[0]).toMatchObject({ hasPhoto: true });
    expect("photo" in items[0]).toBe(false);
    expect((await getIncidentDetail(r.incidentId, null, null)).photo).toBe(photo);
  });

  it("counts neighbor confirmations", async () => {
    const a = await user();
    const b = await user();
    const r = await createReport({ category: "flooding", latitude: P.lat, longitude: P.lng, description: "", storm: storm("flooded") }, a, ip());
    await confirmIncident(r.incidentId, b);
    expect((await store.getIncident(r.incidentId))!.confirmationCount).toBe(1);
  });

  it("rejects incomplete storm reports", async () => {
    const a = await user();
    await expect(createReport({ category: "place", latitude: P.lat, longitude: P.lng, description: "", storm: storm("open") }, a, ip())).rejects.toMatchObject({ status: 422 });
  });

  it("seeds a live-looking Houston storm in demo mode", async () => {
    await ingestAll(true);
    const c = config.sources.demoCenter;
    const { items } = await listIncidents(listQuerySchema.parse({ lat: String(c.lat), lng: String(c.lng), radiusMi: "25", categories: "power,flooding,place" }), null);
    expect(items.length).toBeGreaterThanOrEqual(15);
    expect(new Set(items.map((i) => i.category))).toEqual(new Set(["power", "flooding", "place"]));
    expect(items.some((i) => i.confirmationCount > 0)).toBe(true);
  });
});
