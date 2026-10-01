// Plate-reader proximity: which camera, if any, deserves a heads-up right
// now. Pure, so it can be tested without a browser.

import { distanceMiles, type LatLng } from "./geo";

export interface WatchedCamera {
  id: string;
  lat: number;
  lng: number;
  operator: string | null;
  manufacturer: string | null;
}

export interface CameraHit {
  camera: WatchedCamera;
  distanceM: number;
  /** True when the camera is roughly in the direction you're moving. */
  ahead: boolean;
  /** Other readers within half a mile, not counting this one. */
  othersNear: number;
}

export const ALERT_RADIUS_M = 250;
const NEAR_RADIUS_M = 800;
/** Don't repeat the same camera for this long. */
export const COOLDOWN_MS = 10 * 60_000;
const METERS_PER_MILE = 1609.344;

/** Bearing from a to b, degrees clockwise from north. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * The one camera to warn about: inside the alert radius, not warned about
 * recently, ahead of you if we know which way you're going, nearest first.
 */
export function pickCameraAlert(
  at: LatLng,
  heading: number | null,
  cameras: WatchedCamera[],
  alertedAt: ReadonlyMap<string, number>,
  now: number,
): CameraHit | null {
  const near: { cam: WatchedCamera; d: number; ahead: boolean }[] = [];
  for (const cam of cameras) {
    // Cheap reject: ~0.01° is about a kilometer.
    if (Math.abs(cam.lat - at.lat) > 0.012 || Math.abs(cam.lng - at.lng) > 0.012) continue;
    const d = distanceMiles(at, { lat: cam.lat, lng: cam.lng }) * METERS_PER_MILE;
    if (d > NEAR_RADIUS_M) continue;
    const ahead = heading == null ? true : angleDiff(heading, bearingDeg(at, { lat: cam.lat, lng: cam.lng })) <= 70;
    near.push({ cam, d, ahead });
  }
  if (near.length === 0) return null;
  const candidates = near
    .filter((n) => n.d <= ALERT_RADIUS_M && n.ahead)
    .filter((n) => now - (alertedAt.get(n.cam.id) ?? -Infinity) > COOLDOWN_MS)
    .sort((a, b) => a.d - b.d);
  const pick = candidates[0];
  if (!pick) return null;
  return {
    camera: pick.cam,
    distanceM: Math.round(pick.d),
    ahead: heading != null,
    othersNear: near.filter((n) => n.cam.id !== pick.cam.id).length,
  };
}

/** "400 ft" / "0.3 mi" the way a dashboard would say it. */
export function formatMeters(m: number, es = false): string {
  const ft = m * 3.28084;
  if (ft < 1000) return `${Math.max(50, Math.round(ft / 50) * 50)} ${es ? "pies" : "ft"}`;
  return `${(m / METERS_PER_MILE).toFixed(1)} mi`;
}
