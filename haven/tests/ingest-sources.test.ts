import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStore } from "@/server/store/local";
import { setStoreForTests } from "@/server/store";
import { ingestAll } from "@/server/services/ingest";
import { config } from "@/server/config";

let store: LocalStore;

beforeEach(() => {
  store = new LocalStore(null);
  setStoreForTests(store);
});

describe("switching a source off", () => {
  it("defaults to the live Houston feeds, not demo data", () => {
    vi.stubEnv("INCIDENT_SOURCES", undefined);
    expect(config.sources.enabled).toEqual(["houston_active", "nws_alerts"]);
  });

  it("removes demo incidents once demo is no longer enabled", async () => {
    vi.stubEnv("INCIDENT_SOURCES", "demo");
    await ingestAll(true);
    const seeded = await store.queryIncidents({ since: new Date(0).toISOString(), limit: 500 });
    expect(seeded.filter((i) => i.sourceId === "demo").length).toBeGreaterThan(0);

    // Live feeds are unreachable in tests; "none" keeps them off and demo off.
    vi.stubEnv("INCIDENT_SOURCES", "none");
    await ingestAll(true);
    const after = await store.queryIncidents({ since: new Date(0).toISOString(), limit: 500 });
    expect(after.filter((i) => i.sourceId === "demo")).toHaveLength(0);
    const demoSource = (await store.listSources()).find((s) => s.id === "demo");
    expect(demoSource?.enabled).toBe(false);
  });
});
