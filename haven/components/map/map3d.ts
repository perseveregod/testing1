// The look of the main map: 3D buildings, sky and haze, lighting, a globe when
// zoomed out, and day / night / satellite modes. Everything here uses the free
// OpenFreeMap vector tiles except satellite, which needs a MapTiler key set as
// NEXT_PUBLIC_MAPTILER_KEY in the hosting environment.

import type { FilterSpecification, Map as MlMap } from "maplibre-gl";
import { getCategory, SEVERITY_RANK } from "@/lib/categories";
import { MAP_STYLE_URL } from "@/lib/client/defaults";
import { offsetMeters } from "@/lib/geo";
import type { PublicIncident } from "@/lib/types";

export type MapMode = "auto" | "night" | "day" | "satellite";
export type ResolvedMode = Exclude<MapMode, "auto">;

export const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
// Positron: light gray land, white roads, quiet labels. The calm look the
// big map apps use, instead of the saturated "bright" cartography.
export const DAY_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** Camera used for the "3D" view. */
export const PITCH_3D = 54;
// North-up: rotated maps read as disoriented, and a compass control appears.
export const BEARING_3D = 0;

/** Daytime between 6:30 and 19:30 local time. */
export function isDaytime(d: Date): boolean {
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= 6 * 60 + 30 && m < 19 * 60 + 30;
}

export function resolveMode(mode: MapMode, now: Date): ResolvedMode {
  if (mode === "satellite") return MAPTILER_KEY ? "satellite" : "night";
  if (mode === "auto") return isDaytime(now) ? "day" : "night";
  return mode;
}

export function styleUrlFor(mode: ResolvedMode): string {
  if (mode === "satellite") return `https://api.maptiler.com/maps/hybrid/style.json?key=${encodeURIComponent(MAPTILER_KEY)}`;
  if (mode === "day") return DAY_STYLE_URL;
  return MAP_STYLE_URL;
}

const BUILDINGS_3D = "haven-buildings-3d";
export const BEACONS = "incident-beacons";

// ---- city lights --------------------------------------------------------------
// Zoomed out past this, the city reads as lights from above (think the lobby
// globe in a multiplayer game): a glow per active incident, pulsing where
// it's live, blinking on one by one when the map first opens.

export const LIGHTS = "city-lights";
export const LIGHTS_ZOOM = 12.6;
const LIGHTS_HALO = "city-lights-halo";
const LIGHTS_PULSE = "city-lights-pulse";
const LIGHTS_CORE = "city-lights-core";
// Live lights breathe in three groups, each on its own beat (see pulseLights).
const PULSE_GROUPS = 3;
/** One beat of the pulse; also the length of the paint transition. */
export const PULSE_BEAT_MS = 700;
const pulseLayer = (k: number) => `${LIGHTS_PULSE}-${k}`;
const PULSE_LAYERS = Array.from({ length: PULSE_GROUPS }, (_, k) => pulseLayer(k));
const LIGHT_LAYERS = [LIGHTS_HALO, ...PULSE_LAYERS, LIGHTS_CORE];
const pulseFilter = (k: number): unknown[] => [["get", "live"], ["==", ["%", ["get", "seq"], PULSE_GROUPS], k]];
// The two ends of a breath. Zoom-only values on purpose: a value that reads a
// feature property makes MapLibre rebuild the whole source in its worker on
// every change, which at one change per frame was a third of the main thread.
const PULSE_REST = { radius: ["interpolate", ["linear"], ["zoom"], 8, 4, LIGHTS_ZOOM, 8], opacity: 0.5 };
const PULSE_OUT = { radius: ["interpolate", ["linear"], ["zoom"], 8, 18, LIGHTS_ZOOM, 38], opacity: 0.04 };

function shuffleKey(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** One light per active incident; `seq` is a scattered order for the blink-on. */
export function lightsGeoJson(incidents: PublicIncident[], now = Date.now()): GeoJSON.FeatureCollection {
  const active = incidents.filter((i) => i.status !== "resolved");
  const order = [...active].sort((a, b) => shuffleKey(a.id) - shuffleKey(b.id));
  const seq = new Map(order.map((i, k) => [i.id, k]));
  return {
    type: "FeatureCollection",
    features: active.map((i) => {
      const sev = SEVERITY_RANK[i.severity];
      const fresh = now - new Date(i.createdAt).getTime() < 3_600_000;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [i.longitude, i.latitude] },
        properties: {
          id: i.id,
          color: getCategory(i.category).color,
          sev,
          // Also picks the light's pulse group (seq % 3).
          seq: seq.get(i.id) ?? 0,
          live: sev >= 2 || fresh,
        },
      };
    }),
  };
}

/** Adds the three light layers (idempotent). Visible only below LIGHTS_ZOOM. */
export function addLightsLayers(m: MlMap, night: boolean, before?: string) {
  if (m.getSource(LIGHTS)) return;
  m.addSource(LIGHTS, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  const sevRadius = (lo: number, hi: number) => ["interpolate", ["linear"], ["get", "sev"], 0, lo, 3, hi] as unknown as number;
  m.addLayer(
    {
      id: LIGHTS_HALO,
      type: "circle",
      source: LIGHTS,
      maxzoom: LIGHTS_ZOOM,
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, sevRadius(7, 16), LIGHTS_ZOOM, sevRadius(14, 34)],
        "circle-blur": 1,
        "circle-opacity": night ? 0.65 : 0.4,
      },
    },
    before,
  );
  for (let k = 0; k < PULSE_GROUPS; k++) {
    m.addLayer(
      {
        id: pulseLayer(k),
        type: "circle",
        source: LIGHTS,
        maxzoom: LIGHTS_ZOOM,
        filter: ["all", ...pulseFilter(k)] as unknown as FilterSpecification,
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": PULSE_REST.radius as unknown as number,
          "circle-blur": 0.7,
          "circle-opacity": PULSE_REST.opacity,
          // The GPU eases between the two ends; nothing runs per frame.
          "circle-radius-transition": { duration: PULSE_BEAT_MS, delay: 0 },
          "circle-opacity-transition": { duration: PULSE_BEAT_MS, delay: 0 },
        },
      },
      before,
    );
  }
  m.addLayer(
    {
      id: LIGHTS_CORE,
      type: "circle",
      source: LIGHTS,
      maxzoom: LIGHTS_ZOOM,
      paint: {
        "circle-color": night ? "#ffffff" : ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, sevRadius(1.4, 2.4), LIGHTS_ZOOM, sevRadius(2.4, 4)],
        "circle-blur": 0.15,
        "circle-opacity": night ? 0.95 : 1,
      },
    },
    before,
  );
}

/** Show lights with seq < upto (null = all). Used for the blink-on. */
export function setLightsReveal(m: MlMap, upto: number | null) {
  for (const id of LIGHT_LAYERS) {
    if (!m.getLayer(id)) continue;
    const group = PULSE_LAYERS.indexOf(id);
    const base: unknown[] = group >= 0 ? pulseFilter(group) : [];
    const reveal = upto == null ? [] : [["<", ["get", "seq"], upto]];
    const parts = [...base, ...reveal];
    m.setFilter(id, parts.length === 0 ? null : parts.length === 1 ? (parts[0] as unknown as FilterSpecification) : (["all", ...parts] as unknown as FilterSpecification));
  }
}

/**
 * One beat of the pulse: each group swells and fades for a beat, then settles
 * for two, so the city never pulses in unison. `beat` counts up from 0.
 */
export function pulseLights(m: MlMap, beat: number) {
  for (let k = 0; k < PULSE_GROUPS; k++) {
    const id = pulseLayer(k);
    if (!m.getLayer(id)) continue;
    const end = pulseTarget(beat, k) === "out" ? PULSE_OUT : PULSE_REST;
    m.setPaintProperty(id, "circle-radius", end.radius);
    m.setPaintProperty(id, "circle-opacity", end.opacity);
  }
}

/** Which end of the breath group `k` heads for on this beat. */
export function pulseTarget(beat: number, k: number): "out" | "rest" {
  return (((beat - k) % PULSE_GROUPS) + PULSE_GROUPS) % PULSE_GROUPS === 0 ? "out" : "rest";
}

function firstSymbolLayer(m: MlMap): string | undefined {
  return m.getStyle().layers?.find((l) => l.type === "symbol")?.id;
}

/** Height grows in from flat as you zoom past 14, like the big map apps. */
const grownHeight = (prop: string) =>
  ["interpolate", ["linear"], ["zoom"], 13.5, 0, 15, ["coalesce", ["get", prop], 0]] as unknown as number;

/**
 * Adds 3D buildings, sky, lighting and the globe to whatever base style just
 * loaded. Safe to call after every style change.
 */
export function enhanceStyle(m: MlMap, mode: ResolvedMode) {
  const vector = Boolean(m.getSource("openmaptiles"));
  const night = mode !== "day";

  if (vector && !m.getLayer(BUILDINGS_3D)) {
    // Replace the base style's own buildings with lit, height-tinted ones.
    for (const id of ["building", "building-3d"]) {
      if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "none");
    }
    m.addLayer(
      {
        id: BUILDINGS_3D,
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13.5,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": night
            ? ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0], 0, "#161a24", 40, "#1d2433", 120, "#27324a", 250, "#33425f"]
            : ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0], 0, "#e4e7ec", 40, "#d9dde4", 120, "#ccd2db", 250, "#bec6d2"],
          "fill-extrusion-height": grownHeight("render_height"),
          "fill-extrusion-base": grownHeight("render_min_height"),
          // Opaque extrusions skip the expensive depth-sorted transparency pass.
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbolLayer(m),
    );
  }

  hideBaseClutter(m);

  m.setLight({
    anchor: "viewport",
    color: night ? "#b8c8ff" : "#ffffff",
    intensity: night ? 0.38 : 0.3,
    position: [1.4, 210, 35],
  });

  m.setSky(
    night
      ? {
          "sky-color": "#05070d",
          "horizon-color": "#1a2440",
          "fog-color": "#0b1020",
          "sky-horizon-blend": 0.6,
          "horizon-fog-blend": 0.7,
          "fog-ground-blend": 0.85,
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 0.6, 10, 0],
        }
      : {
          "sky-color": "#c9dcf2",
          "horizon-color": "#e9eff7",
          "fog-color": "#f1f4f8",
          "sky-horizon-blend": 0.55,
          "horizon-fog-blend": 0.75,
          "fog-ground-blend": 0.9,
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 0.6, 10, 0],
        },
  );

  // Globe only when zoomed far out; flat (and cheaper) in the city.
  m.setProjection({ type: ["interpolate", ["linear"], ["zoom"], 8, "vertical-perspective", 10, "mercator"] });

  if (!m.getSource(BEACONS)) {
    m.addSource(BEACONS, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    // Columns of colored light rising from live incidents.
    m.addLayer(
      {
        id: BEACONS,
        type: "fill-extrusion",
        source: BEACONS,
        minzoom: LIGHTS_ZOOM,
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 12, 0, 14, ["get", "height"]],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": night ? 0.6 : 0.5,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbolLayer(m),
    );
  }
}

/** Small round footprints (about 14 m across) that the beacon layer extrudes. */
export function beaconGeoJson(incidents: PublicIncident[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const i of incidents) {
    if (i.status === "resolved") continue;
    const sev = SEVERITY_RANK[i.severity];
    // Only serious incidents get a light column; keeps the scene clean and cheap.
    if (sev < 2) continue;
    const ring: [number, number][] = [];
    for (let k = 0; k <= 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const p = offsetMeters({ lat: i.latitude, lng: i.longitude }, Math.sin(a) * 7, Math.cos(a) * 7);
      ring.push([p.lng, p.lat]);
    }
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: { color: getCategory(i.category).color, height: [60, 110, 180, 260][sev] },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Night-mode tuning for the dark base style: cooler water, roads a touch
 * brighter, softer labels. No-ops for layers a style doesn't have.
 */
export function tuneNightStyle(m: MlMap) {
  const set = (id: string, prop: string, value: unknown) => {
    if (m.getLayer(id)) m.setPaintProperty(id, prop, value);
  };
  set("background", "background-color", "#080a0f");
  set("water", "fill-color", "#0b1524");
  set("waterway", "line-color", "#0b1524");
  set("landuse_park", "fill-color", "#0c1612");
  set("landcover_wood", "fill-color", "#0c1612");
  set("landuse_residential", "fill-color", "#0b0d12");
  set("highway_minor", "line-color", "#1c2029");
  set("highway_major_inner", "line-color", "#2a303c");
  set("highway_major_subtle", "line-color", "#323947");
  set("highway_motorway_inner", "line-color", "#3a4252");
  set("highway_motorway_subtle", "line-color", "#232833");
  for (const l of m.getStyle().layers ?? []) {
    if (l.type === "symbol" && m.getLayer(l.id) && l.layout && "text-field" in l.layout) {
      m.setPaintProperty(l.id, "text-color", "#97a0b0");
      m.setPaintProperty(l.id, "text-halo-color", "#080a0f");
      m.setPaintProperty(l.id, "text-halo-width", 1.2);
    }
  }
}

/** Day tuning for the Positron base: a touch cooler, with quieter labels. */
export function tuneDayStyle(m: MlMap) {
  const set = (id: string, prop: string, value: unknown) => {
    if (m.getLayer(id)) m.setPaintProperty(id, prop, value);
  };
  set("background", "background-color", "#f2f3f5");
  set("water", "fill-color", "#cddff0");
  set("waterway", "line-color", "#cddff0");
  set("park", "fill-color", "#dfe9dc");
  set("landcover_wood", "fill-color", "#dfe9dc");
  set("landuse_residential", "fill-color", "#eceef1");
  set("highway_minor", "line-color", "#ffffff");
  set("highway_major_inner", "line-color", "#ffffff");
  set("highway_major_casing", "line-color", "#d9dde3");
  set("highway_motorway_inner", "line-color", "#fbfbfc");
  set("highway_motorway_casing", "line-color", "#d4d9e0");
  for (const l of m.getStyle().layers ?? []) {
    if (l.type === "symbol" && m.getLayer(l.id) && l.layout && "text-field" in l.layout) {
      m.setPaintProperty(l.id, "text-color", "#5b6372");
      m.setPaintProperty(l.id, "text-halo-color", "#f2f3f5");
      m.setPaintProperty(l.id, "text-halo-width", 1.2);
    }
  }
}

/**
 * Hides the base map's own points of interest, transit stops, one-way arrows
 * and similar icons so incident pins are the only markers competing for
 * attention. Street, place and water names stay.
 */
export function hideBaseClutter(m: MlMap) {
  const noisy = new Set(["poi", "aerodrome_label", "mountain_peak"]);
  for (const l of m.getStyle().layers ?? []) {
    if (l.type !== "symbol" || !m.getLayer(l.id)) continue;
    const sourceLayer = (l as { "source-layer"?: string })["source-layer"] ?? "";
    if (noisy.has(sourceLayer) || /poi|transit|station|oneway|one_way|arrow|airport|shield/i.test(l.id)) {
      m.setLayoutProperty(l.id, "visibility", "none");
    }
  }
}

// ---- arrivals ---------------------------------------------------------------

export const RIPPLE = "incident-ripple";
export const RIPPLE_MS = 1800;

/** One ring per incident that just appeared, in its category color. */
export function rippleGeoJson(incidents: PublicIncident[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: incidents.map((i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [i.longitude, i.latitude] },
      properties: { color: getCategory(i.category).color },
    })),
  };
}

/** Adds the ripple layer (idempotent): an expanding ring that fades out. */
export function addRippleLayer(m: MlMap, before?: string) {
  if (m.getSource(RIPPLE)) return;
  m.addSource(RIPPLE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  m.addLayer(
    {
      id: RIPPLE,
      type: "circle",
      source: RIPPLE,
      paint: {
        "circle-radius": 6,
        "circle-color": ["get", "color"],
        "circle-opacity": 0,
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 2.5,
        "circle-stroke-opacity": 0,
      },
    },
    before,
  );
}

/** Drives the ring: `t` runs 0 → 1 over RIPPLE_MS. */
export function setRipple(m: MlMap, t: number) {
  if (!m.getLayer(RIPPLE)) return;
  const k = Math.min(1, Math.max(0, t));
  const ease = 1 - (1 - k) ** 2;
  m.setPaintProperty(RIPPLE, "circle-radius", 6 + 34 * ease);
  m.setPaintProperty(RIPPLE, "circle-stroke-opacity", 0.85 * (1 - k));
  m.setPaintProperty(RIPPLE, "circle-opacity", 0.18 * (1 - k));
}
