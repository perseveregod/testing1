// The look of the main map: 3D buildings, sky and haze, lighting, a globe when
// zoomed out, and day / night / satellite modes. Everything here uses the free
// OpenFreeMap vector tiles except satellite, which needs a MapTiler key set as
// NEXT_PUBLIC_MAPTILER_KEY in the hosting environment.

import type { Map as MlMap } from "maplibre-gl";
import { getCategory, SEVERITY_RANK } from "@/lib/categories";
import { MAP_STYLE_URL } from "@/lib/client/defaults";
import { offsetMeters } from "@/lib/geo";
import type { PublicIncident } from "@/lib/types";

export type MapMode = "auto" | "night" | "day" | "satellite";
export type ResolvedMode = Exclude<MapMode, "auto">;

export const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
export const DAY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Camera used for the "3D" view. */
export const PITCH_3D = 58;
export const BEARING_3D = -18;

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
            : ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0], 0, "#e9e4dc", 40, "#ddd8d0", 120, "#cfd5de", 250, "#bfc9d8"],
          "fill-extrusion-height": grownHeight("render_height"),
          "fill-extrusion-base": grownHeight("render_min_height"),
          "fill-extrusion-opacity": night ? 0.94 : 0.88,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbolLayer(m),
    );
  }

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
          "sky-color": "#7fb8f5",
          "horizon-color": "#dbe9fa",
          "fog-color": "#eef3f9",
          "sky-horizon-blend": 0.55,
          "horizon-fog-blend": 0.75,
          "fog-ground-blend": 0.9,
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 0.6, 10, 0],
        },
  );

  // A globe when zoomed far out; it flattens as you zoom in.
  m.setProjection({ type: "globe" });

  if (!m.getSource(BEACONS)) {
    m.addSource(BEACONS, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    // Columns of colored light rising from live incidents.
    m.addLayer(
      {
        id: BEACONS,
        type: "fill-extrusion",
        source: BEACONS,
        minzoom: 12,
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 12, 0, 14, ["get", "height"]],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": night ? 0.55 : 0.45,
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
    const ring: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI * 2;
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
