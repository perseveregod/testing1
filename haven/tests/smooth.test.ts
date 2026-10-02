import { describe, expect, it } from "vitest";
import { steppedTime } from "@/lib/client/safewalk";
import { pulseTarget } from "@/components/map/map3d";
import { streetAddress } from "@/lib/houston";

describe("stepped clock (screens re-render on the step, not every second)", () => {
  it("holds its value inside a step and moves on the boundary", () => {
    expect(steppedTime(60_000, 30_000)).toBe(60_000);
    expect(steppedTime(89_999, 30_000)).toBe(60_000);
    expect(steppedTime(90_000, 30_000)).toBe(90_000);
    expect(steppedTime(12_345, 1)).toBe(12_345);
  });
});

describe("city-lights pulse", () => {
  it("swells one group per beat, so the city never pulses in unison", () => {
    for (let beat = 0; beat < 9; beat++) {
      const out = [0, 1, 2].filter((k) => pulseTarget(beat, k) === "out");
      expect(out).toEqual([beat % 3]);
    }
  });
});

describe("street address", () => {
  it("treats the old stored placeholder as no address", () => {
    expect(streetAddress("Approximate location")).toBe("");
    expect(streetAddress("  ")).toBe("");
    expect(streetAddress(null)).toBe("");
    expect(streetAddress("Marcella Street, Independence Heights")).toBe("Marcella Street, Independence Heights");
  });
});
