import { describe, expect, it } from "vitest";
import { approximate, distanceMiles, formatDistance } from "@/lib/geo";
import { moderateText } from "@/lib/moderation";
import { estimateSeverity } from "@/lib/severity";
import { toBlock } from "@/server/sources/format";
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
  it("finds a polygon center", () => {
    expect(polygonCenter({ type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]] })).toEqual({ lat: 1, lng: 1 });
  });
});

describe("live badge", () => {
  it("is reserved for real, active, non-trivial incidents", async () => {
    const { isLive } = await import("@/components/incident/Badges");
    const now = Date.now();
    const base = { status: "active" as const, createdAt: new Date(now - 10 * 60_000).toISOString() };
    expect(isLive({ ...base, severity: "moderate" }, now)).toBe(true);
    expect(isLive({ ...base, severity: "low" }, now)).toBe(false);
    expect(isLive({ ...base, severity: "moderate", isDemo: true }, now)).toBe(false);
    expect(isLive({ ...base, severity: "high", createdAt: new Date(now - 5 * 3_600_000).toISOString() }, now)).toBe(true);
    expect(isLive({ ...base, severity: "moderate", createdAt: new Date(now - 5 * 3_600_000).toISOString() }, now)).toBe(false);
    expect(isLive({ ...base, status: "resolved", severity: "critical" }, now)).toBe(false);
  });
});

describe("recency and privacy", () => {
  it("fades incidents after 2h and floors at 55%", async () => {
    const { recencyFactor } = await import("@/components/incident/Badges");
    const now = Date.now();
    const at = (h: number) => new Date(now - h * 3_600_000).toISOString();
    expect(recencyFactor(at(1), now)).toBe(1);
    expect(recencyFactor(at(13), now)).toBeLessThan(1);
    expect(recencyFactor(at(13), now)).toBeGreaterThan(0.55);
    expect(recencyFactor(at(48), now)).toBe(0.55);
  });
});

describe("feed sections", () => {
  it("puts live incidents first, then buckets ended ones by day", async () => {
    const { timeSection, foldDuplicates } = await import("@/components/incident/IncidentCard");
    const now = new Date(2026, 9, 1, 15, 0).getTime();
    const at = (d: Date, status: "active" | "resolved" = "resolved") => ({ status, createdAt: d.toISOString() });
    // Sections are dictionary keys; the Feed translates them.
    expect(timeSection(at(new Date(2026, 8, 27, 12, 0), "active"), now)).toBe("feed.liveNow");
    expect(timeSection(at(new Date(2026, 9, 1, 9, 0)), now)).toBe("feed.earlierToday");
    expect(timeSection(at(new Date(2026, 8, 30, 22, 0)), now)).toBe("feed.yesterday");
    expect(timeSection(at(new Date(2026, 8, 27, 12, 0)), now)).toBe("feed.older");

    const base = { category: "fire", title: "Structure fire", approximateAddress: "Main St" };
    const folded = foldDuplicates([
      { ...base, id: "ended", status: "resolved", createdAt: "2026-10-01T10:00:00Z" },
      { ...base, id: "live", status: "active", createdAt: "2026-10-01T09:00:00Z" },
      { ...base, id: "other", title: "Grass fire", status: "resolved", createdAt: "2026-10-01T08:00:00Z" },
    ] as never[]);
    expect(folded.map((i) => i.id)).toEqual(["live", "other"]);
  });
});
