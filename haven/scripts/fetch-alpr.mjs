// Build step: fetch Houston-area license plate reader cameras from
// OpenStreetMap (Overpass) into public/data/alpr-houston.json, served from the
// CDN. Fails soft: if Overpass is down, the previous file stays in place.
import { mkdir, writeFile } from "node:fs/promises";

const OUT = new URL("../public/data/alpr-houston.json", import.meta.url);
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

function parse(body) {
  const out = [];
  for (const el of body.elements ?? []) {
    if (el.type !== "node" || typeof el.lat !== "number" || typeof el.lon !== "number") continue;
    const t = el.tags ?? {};
    const dirRaw = t["direction"] ?? t["camera:direction"];
    const dir = dirRaw != null ? Number(String(dirRaw).split(";")[0]) : NaN;
    out.push({
      id: `osm-${el.id}`,
      lat: Math.round(el.lat * 1e5) / 1e5,
      lng: Math.round(el.lon * 1e5) / 1e5,
      operator: t["operator"] ?? null,
      manufacturer: t["manufacturer"] ?? t["brand"] ?? null,
      direction: Number.isFinite(dir) ? ((dir % 360) + 360) % 360 : null,
      note: t["description"] ?? t["note"] ?? null,
    });
  }
  return out;
}

let lastErr = null;
for (const url of MIRRORS) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Haven/0.1 community-safety-app (build)" },
      body: `data=${encodeURIComponent(QUERY)}`,
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    const cameras = parse(await res.json());
    if (cameras.length === 0) throw new Error(`empty result from ${new URL(url).host}`);
    await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
    await writeFile(
      OUT,
      JSON.stringify({ updatedAt: new Date().toISOString(), attribution: "© OpenStreetMap contributors (ODbL), via the DeFlock project", cameras }),
    );
    console.log(`[alpr] wrote ${cameras.length} cameras from ${new URL(url).host}`);
    process.exit(0);
  } catch (err) {
    lastErr = err;
    console.warn(`[alpr] ${err.message}`);
  }
}
console.warn(`[alpr] keeping the previous snapshot (${lastErr?.message ?? "no mirror reachable"})`);
