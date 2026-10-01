"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import { getCategory, SEVERITY_RANK } from "@/lib/categories";
import { distanceMiles, type LatLng } from "@/lib/geo";
import type { PublicIncident } from "@/lib/types";
import { CategoryGlyph } from "@/components/incident/AnimatedIcons";
import { FALLBACK_RASTER_STYLE, isStyleError } from "./mapStyle";
import {
  BEACONS,
  BEARING_3D,
  beaconGeoJson,
  enhanceStyle,
  PITCH_3D,
  resolveMode,
  styleUrlFor,
  tuneNightStyle,
  type MapMode,
  type ResolvedMode,
} from "./map3d";

// Interactive incident map. MapLibre does clustering on a GeoJSON source;
// every visible point/cluster is drawn as an HTML marker whose contents are
// React (portals), so markers stay crisp, accessible buttons with real icons.

export interface MapHandle {
  flyTo(p: LatLng, zoom?: number): void;
  /** Flips between the tilted 3D view and a flat top-down view. */
  toggle3D(): void;
  /** Turns the map back to north-up. */
  resetNorth(): void;
}

export interface Camera {
  bearing: number;
  pitch: number;
}

export interface Viewport {
  center: LatLng;
  radiusMi: number;
  zoom: number;
}

interface Props {
  incidents: PublicIncident[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userPosition: LatLng | null;
  initialCenter: LatLng;
  onViewportChange: (v: Viewport) => void;
  mode: MapMode;
  onCameraChange?: (c: Camera) => void;
}

type Visible =
  | { key: string; kind: "point"; el: HTMLElement; id: string; category: PublicIncident["category"]; severity: number; ended: boolean }
  | { key: string; kind: "cluster"; el: HTMLElement; clusterId: number; count: number; maxSev: number; lng: number; lat: number };

const SOURCE = "incidents";

export const IncidentMap = forwardRef<MapHandle, Props>(function IncidentMap(
  { incidents, selectedId, onSelect, userPosition, initialCenter, onViewportChange, mode, onCameraChange },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const userMarker = useRef<Marker | null>(null);
  const [visible, setVisible] = useState<Visible[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onViewport = useRef(onViewportChange);
  const latest = useRef<PublicIncident[]>(incidents);
  const onSelectRef = useRef(onSelect);
  const onCamera = useRef(onCameraChange);
  const resolved = useRef<ResolvedMode>("night");
  const modeRef = useRef(mode);

  useEffect(() => {
    onViewport.current = onViewportChange;
    onSelectRef.current = onSelect;
    onCamera.current = onCameraChange;
    modeRef.current = mode;
  });

  useImperativeHandle(ref, () => ({
    flyTo(p, zoom) {
      map.current?.flyTo({
        center: [p.lng, p.lat],
        zoom: zoom ?? Math.max(map.current.getZoom(), 14),
        pitch: map.current.getPitch() > 5 ? PITCH_3D : 0,
        duration: 1600,
        curve: 1.6,
        essential: true,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    },
    toggle3D() {
      const m = map.current;
      if (!m) return;
      const flat = m.getPitch() < 5;
      m.easeTo({
        pitch: flat ? PITCH_3D : 0,
        bearing: flat ? BEARING_3D : 0,
        zoom: flat ? Math.max(m.getZoom(), 15) : m.getZoom(),
        duration: 900,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    },
    resetNorth() {
      map.current?.easeTo({ bearing: 0, duration: 600 });
    },
  }));

  const emitViewport = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    const ne = m.getBounds().getNorthEast();
    const radiusMi = distanceMiles({ lat: c.lat, lng: c.lng }, { lat: ne.lat, lng: ne.lng });
    onViewport.current({ center: { lat: c.lat, lng: c.lng }, radiusMi: Math.min(50, Math.max(0.5, radiusMi)), zoom: m.getZoom() });
  }, []);

  // Reconcile HTML markers with what the clustered source currently shows.
  const syncMarkers = useCallback(() => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !m.getSource(SOURCE)) return;
    const features = m.querySourceFeatures(SOURCE);
    const next = new Map<string, Visible>();
    for (const f of features) {
      const p = f.properties as Record<string, unknown>;
      const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const key = p.cluster ? `c${p.cluster_id}` : `p${p.id}`;
      if (next.has(key)) continue;
      let marker = markers.current.get(key);
      if (!marker) {
        const el = document.createElement("div");
        marker = new ml.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(m);
        markers.current.set(key, marker);
      } else {
        marker.setLngLat([lng, lat]);
      }
      const el = marker.getElement();
      next.set(
        key,
        p.cluster
          ? { key, kind: "cluster", el, clusterId: Number(p.cluster_id), count: Number(p.point_count), maxSev: Number(p.maxSev ?? 0), lng, lat }
          : { key, kind: "point", el, id: String(p.id), category: p.category as PublicIncident["category"], severity: Number(p.sevRank), ended: Boolean(p.ended) },
      );
    }
    for (const [key, marker] of markers.current) {
      if (!next.has(key)) {
        marker.remove();
        markers.current.delete(key);
      }
    }
    setVisible([...next.values()]);
  }, []);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let fellBack = false;
    const markerMap = markers.current;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      lib.current = ml;
      resolved.current = resolveMode(modeRef.current, new Date());
      const m = new ml.Map({
        container: container.current,
        style: styleUrlFor(resolved.current),
        center: [initialCenter.lng, initialCenter.lat],
        zoom: 14.6,
        pitch: PITCH_3D,
        bearing: BEARING_3D,
        maxPitch: 72,
        attributionControl: { compact: true },
        fadeDuration: 0,
      });
      map.current = m;

      m.on("error", (e) => {
        // Only a failure of the style document itself warrants the fallback;
        // individual tile errors are retried by MapLibre.
        if (!fellBack && isStyleError(e.error, styleUrlFor(resolved.current))) {
          fellBack = true;
          console.warn("[haven] map style failed, using fallback", e.error?.message);
          m.setStyle(FALLBACK_RASTER_STYLE);
        }
      });
      m.on("style.load", () => {
        if (resolved.current === "night") tuneNightStyle(m);
        try {
          enhanceStyle(m, resolved.current);
        } catch (err) {
          console.warn("[haven] 3D extras unavailable", err);
        }
        if (!m.getSource(SOURCE)) {
          m.addSource(SOURCE, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            cluster: true,
            clusterRadius: 52,
            clusterMaxZoom: 14,
            clusterProperties: { maxSev: ["max", ["get", "sevRank"]] },
          });
          // Soft colored glow under each active incident, like light on wet asphalt.
          m.addLayer({
            id: "incidents-glow",
            type: "circle",
            source: SOURCE,
            filter: ["all", ["!", ["has", "point_count"]], ["!", ["get", "ended"]]],
            paint: {
              "circle-color": ["get", "color"],
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 18, 14, 34, 17, 70],
              "circle-blur": 1,
              "circle-opacity": ["match", ["get", "sevRank"], 3, 0.5, 2, 0.4, 1, 0.3, 0.2],
            },
          });
          // Invisible layer so the source's tiles load and can be queried.
          m.addLayer({ id: "incidents-hit", type: "circle", source: SOURCE, paint: { "circle-opacity": 0, "circle-radius": 1 } });
        }
        // A style swap drops sources; restore the current incidents.
        (m.getSource(SOURCE) as GeoJSONSource).setData(toGeoJson(latest.current));
        (m.getSource(BEACONS) as GeoJSONSource | undefined)?.setData(beaconGeoJson(latest.current));
        setReady(true);
        emitViewport();
      });
      m.on("moveend", () => {
        syncMarkers();
        emitViewport();
        onCamera.current?.({ bearing: m.getBearing(), pitch: m.getPitch() });
      });
      m.on("rotate", () => onCamera.current?.({ bearing: m.getBearing(), pitch: m.getPitch() }));
      m.on("sourcedata", (e) => {
        if (e.sourceId === SOURCE && e.isSourceLoaded) syncMarkers();
      });
      m.on("click", (e) => {
        if ((e.originalEvent.target as HTMLElement).closest(".haven-marker")) return;
        onSelectRef.current(null);
      });
    })().catch((err) => {
      console.error("[haven] map init failed", err);
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      markerMap.forEach((mk) => mk.remove());
      markerMap.clear();
      map.current?.remove();
      map.current = null;
    };
    // initialCenter is only used for the first render by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push incidents into the clustered source.
  useEffect(() => {
    latest.current = incidents;
    const src = map.current?.getSource(SOURCE) as GeoJSONSource | undefined;
    if (!ready || !src) return;
    src.setData(toGeoJson(incidents));
    (map.current?.getSource(BEACONS) as GeoJSONSource | undefined)?.setData(beaconGeoJson(incidents));
  }, [incidents, ready]);

  // Switch between day, night and satellite. Re-checks auto mode every few minutes.
  useEffect(() => {
    if (!ready) return;
    const apply = () => {
      const m = map.current;
      const next = resolveMode(mode, new Date());
      if (!m || next === resolved.current) return;
      resolved.current = next;
      m.setStyle(styleUrlFor(next), { diff: false });
    };
    apply();
    if (mode !== "auto") return;
    const t = setInterval(apply, 5 * 60_000);
    return () => clearInterval(t);
  }, [mode, ready]);

  // User location dot.
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!ready || !m || !ml) return;
    if (!userPosition) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    if (!userMarker.current) {
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Your location");
      el.innerHTML =
        '<span style="position:absolute;inset:0;border-radius:9999px;background:rgba(61,139,255,.35)" class="haven-pulse"></span>' +
        '<span style="position:absolute;inset:4px;border-radius:9999px;background:#3d8bff;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></span>';
      el.style.cssText = "position:relative;width:24px;height:24px;pointer-events:none;z-index:4";
      userMarker.current = new ml.Marker({ element: el }).setLngLat([userPosition.lng, userPosition.lat]).addTo(m);
    } else {
      userMarker.current.setLngLat([userPosition.lng, userPosition.lat]);
    }
  }, [userPosition, ready]);

  // Marker containers are separate stacking contexts, so layer them here:
  // selected > severe > other incidents > clusters > the person's own dot.
  useEffect(() => {
    for (const v of visible) {
      const el = markers.current.get(v.key)?.getElement();
      if (el) el.style.zIndex = v.kind === "cluster" ? "5" : v.id === selectedId ? "30" : String(10 + v.severity);
    }
  }, [visible, selectedId]);

  // Keep the selected incident visible above the preview sheet.
  useEffect(() => {
    const m = map.current;
    const inc = selectedId ? latest.current.find((i) => i.id === selectedId) : null;
    if (!m || !inc) return;
    const pt = m.project([inc.longitude, inc.latitude]);
    const h = m.getContainer().clientHeight;
    // Glide in and tilt toward the incident, like tapping a place in a maps app.
    const tilted = m.getPitch() > 5;
    if (tilted || pt.y > h * 0.42 || pt.y < 120) {
      m.easeTo({
        center: [inc.longitude, inc.latitude],
        offset: [0, -Math.round(h * 0.2)],
        zoom: tilted ? Math.max(m.getZoom(), 15.6) : m.getZoom(),
        pitch: tilted ? 62 : 0,
        duration: tilted ? 1100 : 600,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    }
  }, [selectedId]);

  const zoomIntoCluster = useCallback(async (clusterId: number, lng: number, lat: number) => {
    const m = map.current;
    const src = m?.getSource(SOURCE) as GeoJSONSource | undefined;
    if (!m || !src) return;
    const zoom = await src.getClusterExpansionZoom(clusterId);
    m.easeTo({ center: [lng, lat], zoom: Math.min(zoom + 0.2, 17), duration: 650, easing: (t) => 1 - Math.pow(1 - t, 3) });
  }, []);

  return (
    <>
      {/* maplibre forces position:relative on its container, so size it from a wrapper. */}
      <div className="absolute inset-0 isolate">
        <div ref={container} className="h-full w-full" role="region" aria-label="Incident map" />
      </div>
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg px-8 text-center text-muted">
          The map couldn&apos;t load. The Feed tab still shows nearby incidents.
        </div>
      )}
      {visible.map((v) =>
        createPortal(
          v.kind === "cluster" ? (
            <ClusterMarker count={v.count} maxSev={v.maxSev} onClick={() => zoomIntoCluster(v.clusterId, v.lng, v.lat)} />
          ) : (
            <PointMarker
              category={v.category}
              severity={v.severity}
              ended={v.ended}
              selected={v.id === selectedId}
              onClick={() => onSelect(v.id)}
            />
          ),
          v.el,
          v.key,
        ),
      )}
    </>
  );
});

/** Night tuning, kept under its old name for the small maps. */
export const tuneStyle = tuneNightStyle;

function toGeoJson(incidents: PublicIncident[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: incidents.map((i) => ({
      type: "Feature",
      id: i.id,
      geometry: { type: "Point", coordinates: [i.longitude, i.latitude] },
      properties: {
        id: i.id,
        category: i.category,
        color: getCategory(i.category).color,
        sevRank: SEVERITY_RANK[i.severity],
        ended: i.status === "resolved",
      },
    })),
  };
}

function PointMarker({
  category,
  severity,
  ended,
  selected,
  onClick,
}: {
  category: PublicIncident["category"];
  severity: number;
  ended: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const def = getCategory(category);
  const size = selected ? 46 : severity >= 2 ? 38 : 34;
  const color = ended ? "#7a7f89" : def.color;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${def.label}${ended ? " (ended)" : ""}`}
      aria-pressed={selected}
      className="haven-marker haven-pop relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: selected ? color : "rgba(20, 21, 25, 0.92)",
        color: selected ? "#0b0c0f" : color,
        border: `${selected ? 2.5 : 1.5}px solid ${selected ? "#fff" : color}`,
        opacity: ended ? 0.7 : 1,
        boxShadow: selected ? `0 0 0 8px color-mix(in srgb, ${color} 28%, transparent), 0 8px 24px rgba(0,0,0,.5)` : "0 4px 14px rgba(0,0,0,.45)",
      }}
    >
      {severity >= 3 && !ended && !selected && (
        <span className="haven-pulse absolute inset-0 rounded-full" style={{ background: `color-mix(in srgb, ${color} 40%, transparent)` }} aria-hidden />
      )}
      <CategoryGlyph category={category} animated={!ended} className="relative" style={{ width: size * 0.58, height: size * 0.58 }} />
    </button>
  );
}

function ClusterMarker({ count, maxSev, onClick }: { count: number; maxSev: number; onClick: () => void }) {
  const ring = ["#9b9fa8", "#f5b84b", "#ff8a5c", "#ff5f57"][Math.max(0, Math.min(3, maxSev))];
  const size = count >= 50 ? 52 : count >= 10 ? 46 : 40;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${count} incidents here. Zoom in.`}
      className="haven-marker haven-pop flex items-center justify-center rounded-full text-[14px] font-semibold text-text tnum"
      style={{
        width: size,
        height: size,
        background: "rgba(20, 21, 25, 0.92)",
        border: `2px solid ${ring}`,
        boxShadow: `0 0 0 5px color-mix(in srgb, ${ring} 18%, transparent), 0 4px 14px rgba(0,0,0,.5)`,
        backdropFilter: "blur(4px)",
      }}
    >
      {count}
    </button>
  );
}
