// License plate reader cameras from OpenStreetMap (the DeFlock project).

export const ALPR_ATTRIBUTION = "© OpenStreetMap contributors (ODbL), via the DeFlock project";

export interface AlprCamera {
  id: string;
  lat: number;
  lng: number;
  operator: string | null;
  manufacturer: string | null;
  /** Compass direction the camera faces, in degrees, when mapped. */
  direction: number | null;
  note: string | null;
}

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export function parseOverpass(body: { elements?: OverpassElement[] }): AlprCamera[] {
  const out: AlprCamera[] = [];
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
