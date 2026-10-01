import { NextResponse } from "next/server";
import { ALPR_ATTRIBUTION, parseOverpass, type AlprCamera, type OverpassElement } from "@/lib/alpr";

// License plate reader cameras (Flock Safety and others) as mapped by
// volunteers in OpenStreetMap, the DeFlock project. Open data under ODbL.
//
// This handler is static: Next renders it once at build time and Vercel
// refreshes it in the background every 6 hours (ISR), so the map never waits
// on Overpass and the public instance sees one query every few hours.
export const dynamic = "force-static";
export const revalidate = 21600;

const BBOX = { south: 29.45, west: -95.85, north: 30.15, east: -94.95 };
const MIRRORS = (process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const QUERY = `[out:json][timeout:40];
(
  node["man_made"="surveillance"]["surveillance:type"="ALPR"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["man_made"="surveillance"]["camera:type"="ALPR"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out body;`;

export async function GET() {
  let cameras: AlprCamera[] = [];
  let updatedAt: string | null = null;
  for (const url of MIRRORS) {
    try {
      const res = await fetch(`${url}?data=${encodeURIComponent(QUERY)}`, {
        headers: { "User-Agent": "Haven/0.1 community-safety-app (build)", Accept: "application/json" },
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseOverpass((await res.json()) as { elements?: OverpassElement[] });
      if (parsed.length === 0) throw new Error("empty result");
      cameras = parsed;
      updatedAt = new Date().toISOString();
      break;
    } catch (err) {
      console.warn(`[haven] ALPR fetch failed (${new URL(url).host}): ${(err as Error).message}`);
    }
  }
  return NextResponse.json(
    { updatedAt, attribution: ALPR_ATTRIBUTION, cameras },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
