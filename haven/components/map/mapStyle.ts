import type { StyleSpecification } from "maplibre-gl";
import { MAP_STYLE_URL } from "@/lib/client/defaults";

/** True when MapLibre failed to fetch the style document itself. */
export function isStyleError(err: unknown): boolean {
  const url = (err as { url?: string } | undefined)?.url;
  return typeof url === "string" && url.split("?")[0] === MAP_STYLE_URL.split("?")[0];
}

/**
 * Used if the vector style can't load (blocked CDN, outage). Standard OSM
 * raster tiles, dimmed to sit with the dark UI. Fine for development; for
 * production traffic use NEXT_PUBLIC_MAP_STYLE_URL with a provider you control.
 */
export const FALLBACK_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0a0d13" } },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      // Swapping min/max brightness inverts the light tiles; full desaturation
      // keeps it a neutral charcoal that sits with the UI.
      paint: {
        "raster-brightness-min": 0.82,
        "raster-brightness-max": 0.06,
        "raster-saturation": -1,
        "raster-contrast": 0.25,
      },
    },
  ],
};
