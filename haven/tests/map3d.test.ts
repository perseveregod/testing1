import { describe, expect, it } from "vitest";
import { beaconGeoJson, isDaytime, resolveMode, styleUrlFor } from "@/components/map/map3d";
import type { PublicIncident } from "@/lib/types";

const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m);

describe("map modes", () => {
  it("picks day or night by local time in auto mode", () => {
    expect(isDaytime(at(12))).toBe(true);
    expect(isDaytime(at(6, 15))).toBe(false);
    expect(isDaytime(at(23))).toBe(false);
    expect(resolveMode("auto", at(13))).toBe("day");
    expect(resolveMode("auto", at(1))).toBe("night");
    expect(resolveMode("night", at(13))).toBe("night");
  });

  it("falls back to night when satellite has no key", () => {
    // No NEXT_PUBLIC_MAPTILER_KEY in tests.
    expect(resolveMode("satellite", at(13))).toBe("night");
    expect(styleUrlFor("day")).toContain("openfreemap");
  });
});

describe("incident beacons", () => {
  const base = {
    latitude: 29.7604,
    longitude: -95.3698,
    category: "fire",
    severity: "high",
    status: "active",
  } as unknown as PublicIncident;

  it("raises a taller column for more serious live incidents and none for ended ones", () => {
    const fc = beaconGeoJson([
      base,
      { ...base, severity: "low" } as PublicIncident,
      { ...base, status: "resolved" } as PublicIncident,
    ]);
    expect(fc.features).toHaveLength(2);
    const [high, low] = fc.features.map((f) => (f.properties as { height: number }).height);
    expect(high).toBeGreaterThan(low);
    const ring = (fc.features[0].geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
