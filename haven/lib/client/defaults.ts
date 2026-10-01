// Where the map opens when we don't know the person's location yet. Matches
// the demo data's center by default so first-time visitors see something.
export const DEFAULT_CENTER = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? 47.6097) || 47.6097,
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? -122.3331) || -122.3331,
};

export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/dark";

export const EMERGENCY_NUMBER = process.env.NEXT_PUBLIC_EMERGENCY_NUMBER || "911";
