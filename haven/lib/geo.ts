export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
export const METERS_PER_MILE = 1609.344;

const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceMiles(a: LatLng, b: LatLng): number {
  return distanceMeters(a, b) / METERS_PER_MILE;
}

export function formatDistance(miles: number | null | undefined): string {
  if (miles == null || !Number.isFinite(miles)) return "";
  if (miles < 0.1) return `${Math.max(50, Math.round((miles * 5280) / 50) * 50)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/** Bounding box that contains a circle; used to pre-filter before exact distance. */
export function boundingBox(center: LatLng, radiusM: number) {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(0.01, Math.cos(toRad(center.lat)));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/**
 * Snap a point to a grid so stored and displayed locations never pinpoint a
 * reporter's door. 3 decimals ≈ 110 m; 2 decimals ≈ 1.1 km.
 */
export function approximate(p: LatLng, decimals = 3): LatLng {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Deterministic pseudo-random offset (meters) used for demo data placement. */
export function offsetMeters(p: LatLng, northM: number, eastM: number): LatLng {
  const dLat = (northM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = (eastM / (EARTH_RADIUS_M * Math.cos(toRad(p.lat)))) * (180 / Math.PI);
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}
