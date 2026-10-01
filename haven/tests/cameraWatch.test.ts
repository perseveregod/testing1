import { describe, expect, it } from "vitest";
import { bearingDeg, COOLDOWN_MS, formatMeters, pickCameraAlert } from "@/lib/cameraWatch";

const me = { lat: 29.7437, lng: -95.3912 };
// ~180 m north and ~180 m south of me.
const north = { id: "n", lat: 29.7453, lng: -95.3912, operator: "City", manufacturer: "Flock" };
const south = { id: "s", lat: 29.7421, lng: -95.3912, operator: null, manufacturer: null };
const far = { id: "f", lat: 29.76, lng: -95.37, operator: null, manufacturer: null };

describe("plate reader watch", () => {
  it("warns about the nearest camera inside the radius", () => {
    const hit = pickCameraAlert(me, null, [far, north, south], new Map(), 0);
    expect(hit?.camera.id).toMatch(/n|s/);
    expect(hit!.distanceM).toBeLessThan(250);
    expect(hit!.othersNear).toBe(1);
    expect(hit!.ahead).toBe(false);
  });

  it("prefers the camera you're driving toward", () => {
    expect(pickCameraAlert(me, 0, [north, south], new Map(), 0)?.camera.id).toBe("n");
    expect(pickCameraAlert(me, 180, [north, south], new Map(), 0)?.camera.id).toBe("s");
    expect(pickCameraAlert(me, 90, [north, south], new Map(), 0)).toBeNull();
  });

  it("doesn't nag about the same camera twice in ten minutes", () => {
    const alerted = new Map([["n", 1_000_000]]);
    expect(pickCameraAlert(me, 0, [north], alerted, 1_000_000 + 60_000)).toBeNull();
    expect(pickCameraAlert(me, 0, [north], alerted, 1_000_000 + COOLDOWN_MS + 1)?.camera.id).toBe("n");
  });

  it("formats distances like a dashboard", () => {
    expect(formatMeters(120)).toBe("400 ft");
    expect(formatMeters(1200)).toBe("0.7 mi");
    expect(formatMeters(120, true)).toBe("400 pies");
    expect(Math.round(bearingDeg(me, north))).toBe(0);
  });
});
