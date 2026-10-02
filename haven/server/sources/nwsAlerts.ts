import type { CategoryId, Severity } from "@/lib/types";
import { fetchJson, type NormalizedIncident, type SourceAdapter } from "./types";

// US National Weather Service active alerts (public, no key; requires a
// User-Agent with contact info). https://www.weather.gov/documentation/services-web-api
// Only alerts with a polygon are used; the point is the polygon's center.

interface Feature {
  geometry: { type: string; coordinates: unknown } | null;
  properties: {
    id: string;
    event: string;
    severity: string;
    messageType: string;
    sent: string;
    expires?: string;
    ends?: string | null;
    areaDesc?: string;
    headline?: string | null;
    instruction?: string | null;
  };
}

const SEVERITY: Record<string, Severity> = {
  Extreme: "critical",
  Severe: "high",
  Moderate: "moderate",
  Minor: "low",
};

function category(event: string): CategoryId {
  return /evacuat|civil|shelter|hazardous materials|nuclear|law enforcement|911|fire warning|child abduction/i.test(event)
    ? "public_safety"
    : "severe_weather";
}

/** Average of outer-ring vertices: good enough to place a marker. */
export function polygonCenter(geom: { type: string; coordinates: unknown }): { lat: number; lng: number } | null {
  let rings: number[][][] = [];
  if (geom.type === "Polygon") rings = [(geom.coordinates as number[][][])[0]!];
  else if (geom.type === "MultiPolygon") rings = (geom.coordinates as number[][][][]).map((p) => p[0]!);
  const pts = rings.flat().filter((p) => Array.isArray(p) && p.length >= 2);
  if (!pts.length) return null;
  const lng = pts.reduce((s, p) => s + p[0]!, 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1]!, 0) / pts.length;
  return { lat: Math.round(lat * 1e4) / 1e4, lng: Math.round(lng * 1e4) / 1e4 };
}

export const nwsAlertsAdapter: SourceAdapter = {
  meta: {
    id: "nws_alerts",
    name: "National Weather Service alerts",
    kind: "weather",
    attribution: "NOAA National Weather Service (api.weather.gov)",
    url: "https://www.weather.gov/alerts",
  },
  authoritativeActiveSet: true,
  notify: true,
  async fetch(ctx) {
    const params = new URLSearchParams({ status: "actual" });
    // One state's alerts, not the whole country's. NWS_AREA overrides.
    params.set("area", process.env.NWS_AREA || "TX");
    const body = (await fetchJson(`https://api.weather.gov/alerts/active?${params}`, ctx, 12000)) as {
      features?: Feature[];
    };
    const out: NormalizedIncident[] = [];
    for (const f of body.features ?? []) {
      const p = f.properties;
      if (!f.geometry || p.messageType === "Cancel") continue;
      const severity = SEVERITY[p.severity];
      if (!severity || severity === "low") continue;
      const c = polygonCenter(f.geometry);
      if (!c) continue;
      const ends = p.ends ?? p.expires;
      const expired = ends ? new Date(ends).getTime() < ctx.now.getTime() : false;
      out.push({
        externalId: p.id,
        category: category(p.event),
        title: p.event,
        description: [p.headline, p.instruction].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 600),
        latitude: c.lat,
        longitude: c.lng,
        approximateAddress: (p.areaDesc ?? "").slice(0, 120),
        severity,
        status: expired ? "resolved" : "active",
        observedAt: new Date(p.sent).toISOString(),
      });
    }
    return out;
  },
};
