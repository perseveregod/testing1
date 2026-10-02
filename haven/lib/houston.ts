// Houston, by neighborhood. Approximate centers and a radius for the parts of
// town people actually say ("Montrose", "the Heights", "Alief"), so a block
// address can carry the name a Houstonian would use. Hand-placed, not official
// boundaries: good for "near Montrose", never for anything legal.

import { distanceMiles, type LatLng } from "./geo";

export interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
  /** Roughly how far the name stretches, in miles. */
  radiusMi: number;
}

export const NEIGHBORHOODS: Neighborhood[] = [
  // Inside the Loop
  { name: "Downtown", lat: 29.7589, lng: -95.3677, radiusMi: 0.8 },
  { name: "Midtown", lat: 29.7405, lng: -95.3803, radiusMi: 0.7 },
  { name: "Montrose", lat: 29.743, lng: -95.3905, radiusMi: 0.9 },
  { name: "Museum District", lat: 29.7259, lng: -95.3883, radiusMi: 0.6 },
  { name: "Texas Medical Center", lat: 29.707, lng: -95.401, radiusMi: 0.8 },
  { name: "Rice Village", lat: 29.7165, lng: -95.416, radiusMi: 0.5 },
  { name: "West University", lat: 29.718, lng: -95.433, radiusMi: 0.8 },
  { name: "Bellaire", lat: 29.7058, lng: -95.4588, radiusMi: 1.1 },
  { name: "Upper Kirby", lat: 29.7365, lng: -95.417, radiusMi: 0.6 },
  { name: "Greenway Plaza", lat: 29.7325, lng: -95.432, radiusMi: 0.5 },
  { name: "River Oaks", lat: 29.756, lng: -95.413, radiusMi: 0.9 },
  { name: "Galleria", lat: 29.739, lng: -95.462, radiusMi: 1.0 },
  { name: "Tanglewood", lat: 29.753, lng: -95.478, radiusMi: 0.8 },
  { name: "Memorial Park", lat: 29.765, lng: -95.435, radiusMi: 0.9 },
  { name: "Rice Military", lat: 29.766, lng: -95.408, radiusMi: 0.6 },
  { name: "Washington Ave", lat: 29.772, lng: -95.398, radiusMi: 0.6 },
  { name: "The Heights", lat: 29.796, lng: -95.399, radiusMi: 1.2 },
  { name: "Woodland Heights", lat: 29.78, lng: -95.386, radiusMi: 0.5 },
  { name: "Timbergrove", lat: 29.803, lng: -95.43, radiusMi: 0.8 },
  { name: "Garden Oaks", lat: 29.832, lng: -95.419, radiusMi: 0.8 },
  { name: "Oak Forest", lat: 29.839, lng: -95.442, radiusMi: 1.0 },
  { name: "Independence Heights", lat: 29.83, lng: -95.399, radiusMi: 0.7 },
  { name: "Northside", lat: 29.792, lng: -95.361, radiusMi: 0.9 },
  { name: "Lindale Park", lat: 29.808, lng: -95.361, radiusMi: 0.6 },
  { name: "Fifth Ward", lat: 29.773, lng: -95.338, radiusMi: 0.9 },
  { name: "Denver Harbor", lat: 29.77, lng: -95.314, radiusMi: 0.8 },
  { name: "Kashmere Gardens", lat: 29.802, lng: -95.322, radiusMi: 0.9 },
  { name: "Trinity Gardens", lat: 29.814, lng: -95.298, radiusMi: 0.9 },
  { name: "Second Ward", lat: 29.751, lng: -95.34, radiusMi: 0.7 },
  { name: "EaDo", lat: 29.751, lng: -95.354, radiusMi: 0.6 },
  { name: "East End", lat: 29.739, lng: -95.306, radiusMi: 1.2 },
  { name: "Eastwood", lat: 29.743, lng: -95.33, radiusMi: 0.6 },
  { name: "Third Ward", lat: 29.723, lng: -95.36, radiusMi: 0.9 },
  { name: "University of Houston", lat: 29.72, lng: -95.342, radiusMi: 0.6 },
  { name: "MacGregor", lat: 29.713, lng: -95.37, radiusMi: 0.7 },
  { name: "Gulfgate", lat: 29.689, lng: -95.319, radiusMi: 1.0 },
  { name: "Sunnyside", lat: 29.667, lng: -95.362, radiusMi: 1.2 },
  { name: "South Park", lat: 29.662, lng: -95.335, radiusMi: 1.0 },
  { name: "NRG Park", lat: 29.685, lng: -95.408, radiusMi: 0.8 },
  { name: "Braeswood", lat: 29.695, lng: -95.425, radiusMi: 0.9 },
  { name: "Meyerland", lat: 29.683, lng: -95.466, radiusMi: 1.1 },
  { name: "Westbury", lat: 29.662, lng: -95.472, radiusMi: 1.0 },
  { name: "Hiram Clarke", lat: 29.628, lng: -95.442, radiusMi: 1.2 },
  { name: "Harrisburg", lat: 29.725, lng: -95.265, radiusMi: 1.0 },
  { name: "Pleasantville", lat: 29.765, lng: -95.262, radiusMi: 0.8 },
  { name: "Cottage Grove", lat: 29.788, lng: -95.428, radiusMi: 0.5 },
  // West and southwest
  { name: "Gulfton", lat: 29.718, lng: -95.485, radiusMi: 0.9 },
  { name: "Sharpstown", lat: 29.7, lng: -95.525, radiusMi: 1.3 },
  { name: "Fondren Southwest", lat: 29.666, lng: -95.511, radiusMi: 1.2 },
  { name: "Chinatown", lat: 29.705, lng: -95.56, radiusMi: 1.0 },
  { name: "Westchase", lat: 29.731, lng: -95.572, radiusMi: 1.2 },
  { name: "Alief", lat: 29.702, lng: -95.594, radiusMi: 1.8 },
  { name: "Memorial", lat: 29.77, lng: -95.525, radiusMi: 1.8 },
  { name: "Memorial City", lat: 29.78, lng: -95.552, radiusMi: 0.9 },
  { name: "Spring Branch", lat: 29.803, lng: -95.51, radiusMi: 2.0 },
  { name: "Energy Corridor", lat: 29.78, lng: -95.63, radiusMi: 2.0 },
  { name: "Bear Creek", lat: 29.88, lng: -95.66, radiusMi: 2.0 },
  { name: "Katy", lat: 29.7858, lng: -95.8245, radiusMi: 3.0 },
  { name: "Cinco Ranch", lat: 29.739, lng: -95.758, radiusMi: 2.5 },
  { name: "Missouri City", lat: 29.6186, lng: -95.5377, radiusMi: 2.5 },
  { name: "Stafford", lat: 29.6161, lng: -95.5577, radiusMi: 1.5 },
  { name: "Sugar Land", lat: 29.6197, lng: -95.6349, radiusMi: 3.0 },
  // North
  { name: "Acres Homes", lat: 29.862, lng: -95.435, radiusMi: 1.5 },
  { name: "Inwood Forest", lat: 29.87, lng: -95.478, radiusMi: 1.0 },
  { name: "Northline", lat: 29.849, lng: -95.38, radiusMi: 0.9 },
  { name: "Aldine", lat: 29.933, lng: -95.38, radiusMi: 2.0 },
  { name: "Greenspoint", lat: 29.949, lng: -95.414, radiusMi: 1.5 },
  { name: "Willowbrook", lat: 29.958, lng: -95.54, radiusMi: 1.8 },
  { name: "Jersey Village", lat: 29.887, lng: -95.563, radiusMi: 1.5 },
  { name: "Cypress", lat: 29.9691, lng: -95.6972, radiusMi: 3.5 },
  { name: "Spring", lat: 30.0799, lng: -95.4172, radiusMi: 3.0 },
  { name: "The Woodlands", lat: 30.1658, lng: -95.4613, radiusMi: 4.0 },
  { name: "Tomball", lat: 30.0972, lng: -95.6161, radiusMi: 3.0 },
  { name: "Humble", lat: 29.9988, lng: -95.2622, radiusMi: 2.5 },
  { name: "Kingwood", lat: 30.0536, lng: -95.183, radiusMi: 3.0 },
  { name: "Atascocita", lat: 29.9994, lng: -95.1766, radiusMi: 2.5 },
  // East and southeast
  { name: "Northshore", lat: 29.79, lng: -95.22, radiusMi: 1.5 },
  { name: "Galena Park", lat: 29.7336, lng: -95.23, radiusMi: 1.2 },
  { name: "Channelview", lat: 29.776, lng: -95.114, radiusMi: 2.0 },
  { name: "Baytown", lat: 29.7355, lng: -94.9774, radiusMi: 3.5 },
  { name: "Pasadena", lat: 29.6911, lng: -95.2091, radiusMi: 2.5 },
  { name: "Deer Park", lat: 29.7052, lng: -95.1238, radiusMi: 2.0 },
  { name: "La Porte", lat: 29.6658, lng: -95.0194, radiusMi: 2.5 },
  { name: "South Houston", lat: 29.663, lng: -95.235, radiusMi: 1.0 },
  { name: "Hobby", lat: 29.645, lng: -95.279, radiusMi: 1.5 },
  { name: "Pearland", lat: 29.5636, lng: -95.286, radiusMi: 3.5 },
  { name: "Friendswood", lat: 29.5294, lng: -95.201, radiusMi: 2.5 },
  { name: "Clear Lake", lat: 29.564, lng: -95.118, radiusMi: 2.5 },
  { name: "Webster", lat: 29.5377, lng: -95.1183, radiusMi: 1.2 },
  { name: "League City", lat: 29.5075, lng: -95.0949, radiusMi: 3.0 },
];

/**
 * The neighborhood name for a point, or null when it's outside anything we
 * name. Picks the name whose "reach" covers the point best, so Rice Village
 * wins over West U from the middle of the Village, and Alief still claims a
 * point two miles from its center.
 */
export function neighborhoodFor(p: LatLng): string | null {
  let best: { name: string; score: number } | null = null;
  for (const n of NEIGHBORHOODS) {
    // Cheap reject before the trig: ~0.1° is about 6 miles.
    if (Math.abs(n.lat - p.lat) > 0.1 || Math.abs(n.lng - p.lng) > 0.1) continue;
    const score = distanceMiles(p, { lat: n.lat, lng: n.lng }) / n.radiusMi;
    if (score <= 1 && (!best || score < best.score)) best = { name: n.name, score };
  }
  return best?.name ?? null;
}

/** "Montrose" if the address doesn't already say so. */
export function neighborhoodLabel(p: LatLng, address: string | null | undefined): string | null {
  const name = neighborhoodFor(p);
  if (!name) return null;
  return address && address.toLowerCase().includes(name.toLowerCase()) ? null : name;
}

/** Houston's freeways, the way people say them. */
export const FREEWAY_NAMES = [
  "Katy Freeway",
  "Gulf Freeway",
  "North Freeway",
  "Southwest Freeway",
  "Eastex Freeway",
  "Northwest Freeway",
  "East Freeway",
  "South Freeway",
  "the Loop",
  "Beltway 8",
] as const;

/**
 * The street part of an incident's address, or "" when there isn't one.
 * (Older community reports stored the English words "Approximate location"
 * where the address goes; treat that as no address so it can be translated.)
 */
export function streetAddress(address: string | null | undefined): string {
  const a = (address ?? "").trim();
  return a.toLowerCase() === "approximate location" ? "" : a;
}
