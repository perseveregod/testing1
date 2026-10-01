import { describe, expect, it } from "vitest";
import { parseOverpass, type OverpassElement } from "@/lib/alpr";

const sample: { elements: OverpassElement[] } = {
  elements: [
    { type: "node", id: 1, lat: 29.80001234, lon: -95.40, tags: { man_made: "surveillance", "surveillance:type": "ALPR", manufacturer: "Flock Safety", operator: "Houston Police Department", direction: "180" } },
    { type: "node", id: 2, lat: 29.70, lon: -95.30, tags: { man_made: "surveillance", "camera:type": "ALPR", "camera:direction": "45;225" } },
    { type: "way", id: 3, tags: { man_made: "surveillance" } },
    { type: "node", id: 4, lat: 29.75, lon: -95.35, tags: { man_made: "surveillance", "surveillance:type": "ALPR", direction: "NE" } },
  ],
};

describe("ALPR parser", () => {
  it("keeps nodes only, rounds coordinates, normalizes direction", () => {
    const cams = parseOverpass(sample);
    expect(cams.map((c) => c.id)).toEqual(["osm-1", "osm-2", "osm-4"]);
    expect(cams[0]).toMatchObject({ lat: 29.80001, manufacturer: "Flock Safety", operator: "Houston Police Department", direction: 180 });
    expect(cams[1]!.direction).toBe(45);
    expect(cams[2]!.direction).toBeNull();
  });
});
