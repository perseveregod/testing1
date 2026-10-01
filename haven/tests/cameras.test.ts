import { afterEach, describe, expect, it, vi } from "vitest";
import { alprCameras, parseOverpass, resetAlprCacheForTests, type OverpassElement } from "@/server/sources/cameras";

const sample: { elements: OverpassElement[] } = {
  elements: [
    { type: "node", id: 1, lat: 29.80, lon: -95.40, tags: { man_made: "surveillance", "surveillance:type": "ALPR", manufacturer: "Flock Safety", operator: "Houston Police Department", direction: "180" } },
    { type: "node", id: 2, lat: 29.70, lon: -95.30, tags: { man_made: "surveillance", "camera:type": "ALPR", "camera:direction": "45;225" } },
    { type: "way", id: 3, tags: { man_made: "surveillance" } },
    { type: "node", id: 4, lat: 29.75, lon: -95.35, tags: { man_made: "surveillance", "surveillance:type": "ALPR", direction: "NE" } },
  ],
};

afterEach(() => {
  resetAlprCacheForTests();
  vi.unstubAllGlobals();
});

describe("ALPR cameras", () => {
  it("parses Overpass nodes into cameras with normalized direction", () => {
    const cams = parseOverpass(sample);
    expect(cams.map((c) => c.id)).toEqual(["osm-1", "osm-2", "osm-4"]);
    expect(cams[0]).toMatchObject({ manufacturer: "Flock Safety", operator: "Houston Police Department", direction: 180 });
    expect(cams[1]!.direction).toBe(45);
    expect(cams[2]!.direction).toBeNull();
  });

  it("fetches once, caches, and keeps serving stale data when Overpass fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => sample });
    vi.stubGlobal("fetch", fetchMock);
    const first = await alprCameras();
    expect(first.items).toHaveLength(3);
    const second = await alprCameras();
    expect(second.items).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String(fetchMock.mock.calls[0]![1].body);
    expect(decodeURIComponent(body)).toContain('"surveillance:type"="ALPR"');
  });

  it("returns an empty list, not an error, when the first fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const r = await alprCameras();
    expect(r.items).toEqual([]);
    expect(r.updatedAt).toBeNull();
  });
});
