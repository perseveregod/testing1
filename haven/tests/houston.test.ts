import { describe, expect, it } from "vitest";
import { neighborhoodFor, neighborhoodLabel } from "@/lib/houston";

describe("Houston neighborhoods", () => {
  it("names the parts of town people say", () => {
    expect(neighborhoodFor({ lat: 29.7437, lng: -95.3912 })).toBe("Montrose");
    expect(neighborhoodFor({ lat: 29.7589, lng: -95.3677 })).toBe("Downtown");
    expect(neighborhoodFor({ lat: 29.7975, lng: -95.4 })).toBe("The Heights");
    expect(neighborhoodFor({ lat: 29.849, lng: -95.381 })).toBe("Northline");
    expect(neighborhoodFor({ lat: 29.7165, lng: -95.416 })).toBe("Rice Village");
  });
  it("says nothing outside anything it knows", () => {
    expect(neighborhoodFor({ lat: 30.6, lng: -96.3 })).toBeNull(); // College Station
    expect(neighborhoodFor({ lat: 29.3, lng: -94.8 })).toBeNull(); // Galveston
  });
  it("doesn't repeat a name the address already carries", () => {
    expect(neighborhoodLabel({ lat: 29.7437, lng: -95.3912 }, "Westheimer Rd, Montrose")).toBeNull();
    expect(neighborhoodLabel({ lat: 29.7437, lng: -95.3912 }, "1200 Westheimer Rd")).toBe("Montrose");
  });
});

import { searchNeighborhoods } from "@/lib/houston";

describe("neighborhood search (no GPS, no network)", () => {
  it("offers well-known neighborhoods before anything is typed", () => {
    const names = searchNeighborhoods("").map((n) => n.name);
    expect(names).toContain("Downtown");
    expect(names).toContain("The Heights");
    expect(names.length).toBeLessThanOrEqual(6);
  });
  it("matches by prefix first, ignoring case and a leading \"The\"", () => {
    expect(searchNeighborhoods("heigh")[0]?.name).toBe("The Heights");
    expect(searchNeighborhoods("MONT")[0]?.name).toBe("Montrose");
    expect(searchNeighborhoods("heights").map((n) => n.name)).toContain("Independence Heights");
    expect(searchNeighborhoods("zzzz")).toEqual([]);
  });
});
