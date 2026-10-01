import { describe, expect, it } from "vitest";
import { approximate, distanceMiles, formatDistance } from "@/lib/geo";
import { moderateText } from "@/lib/moderation";
import { estimateSeverity } from "@/lib/severity";
import { toBlock, seattleLocalToIso } from "@/server/sources/seattleFire";
import { polygonCenter } from "@/server/sources/nwsAlerts";

describe("geo", () => {
  it("measures distance", () => {
    const d = distanceMiles({ lat: 47.6062, lng: -122.3321 }, { lat: 47.6205, lng: -122.3493 });
    expect(d).toBeGreaterThan(1.1);
    expect(d).toBeLessThan(1.4);
  });
  it("formats distance", () => {
    expect(formatDistance(0.01)).toBe("50 ft");
    expect(formatDistance(2.345)).toBe("2.3 mi");
    expect(formatDistance(14.6)).toBe("15 mi");
  });
  it("rounds coordinates for privacy", () => {
    expect(approximate({ lat: 47.612345, lng: -122.334567 })).toEqual({ lat: 47.612, lng: -122.335 });
  });
});

describe("moderation", () => {
  it("redacts contact details and links", () => {
    const r = moderateText("Call 206-555-0134 or email a@b.com, see https://x.io/y");
    expect(r.ok && r.text).toBe("Call [removed] or email [removed], see [link removed]");
  });
  it("strips house numbers but keeps streets", () => {
    const r = moderateText("Crash in front of 1234 Pine St");
    expect(r.ok && r.text).toBe("Crash in front of Pine St");
  });
  it("rejects threats, doxxing and profiling", () => {
    expect(moderateText("I will kill him").ok).toBe(false);
    expect(moderateText("his name is John Smith").ok).toBe(false);
    expect(moderateText("suspicious black guy walking").ok).toBe(false);
  });
  it("enforces length", () => {
    expect(moderateText("a".repeat(400)).ok).toBe(false);
  });
});

describe("severity", () => {
  it("escalates on keywords and caps user reports at high", () => {
    expect(estimateSeverity("fire", "structure fire spreading")).toBe("high");
    expect(estimateSeverity("traffic_accident", "multiple vehicles involved")).toBe("high");
    expect(estimateSeverity("traffic_accident", "minor fender bender")).toBe("low");
  });
});

describe("source adapters", () => {
  it("reduces addresses to the hundred block", () => {
    expect(toBlock("6561 PHINNEY AVE N")).toBe("6500 block of Phinney Ave N");
  });
  it("converts Seattle local time to UTC (PDT = UTC-7)", () => {
    expect(seattleLocalToIso("2026-09-30T20:02:00.000")).toBe("2026-10-01T03:02:00.000Z");
  });
  it("finds a polygon center", () => {
    expect(polygonCenter({ type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]] })).toEqual({ lat: 1, lng: 1 });
  });
});
