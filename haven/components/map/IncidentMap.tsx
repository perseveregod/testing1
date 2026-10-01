"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import { getCategory, SEVERITY_RANK } from "@/lib/categories";
import { STATE_STYLE, stormFade } from "@/lib/storm";
import type { StormState } from "@/lib/types";
import { distanceMiles, type LatLng } from "@/lib/geo";
import type { PublicIncident } from "@/lib/types";
import { CategoryGlyph } from "@/components/incident/AnimatedIcons";
import { FALLBACK_RASTER_STYLE, isStyleError } from "./mapStyle";
import {
  BEACONS,
  BEARING_3D,
  beaconGeoJson,
  ACTIVITY,
  activityGeoJson,
  addActivityLayer,
  enhanceStyle,
  PITCH_3D,
  resolveMode,
  styleUrlFor,
  tuneNightStyle,
  tuneDayStyle,
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
  /** Frames a set of points (e.g. live incidents) with room for the overlays. */
  /** Returns false if the map isn't ready yet. */
  fitTo(points: LatLng[]): boolean;
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
  /** License plate reader cameras to draw (null hides the layer). */
  cameras?: GeoJSON.FeatureCollection | null;
  onCameraPick?: (props: Record<string, unknown>, at: LatLng) => void;
}

type Visible =
  | {
      key: string;
      kind: "point";
      el: HTMLElement;
      id: string;
      category: PublicIncident["category"];
      severity: number;
      ended: boolean;
      age: number;
      stormState: StormState | null;
      confirms: number;
      stormFadeValue: number;
    }
  | {
      key: string;
      kind: "cluster";
      el: HTMLElement;
      clusterId: number;
      count: number;
      maxSev: number;
      lng: number;
      lat: number;
    };

const RING = "haven-ring";
const CAMERAS = "alpr-cameras";
const RING_METERS = 1609.344;
const SOURCE = "incidents";

export const IncidentMap = forwardRef<MapHandle, Props>(function IncidentMap(
  {
    incidents,
    selectedId,
    onSelect,
    userPosition,
    initialCenter,
    onViewportChange,
    mode,
    onCameraChange,
    cameras,
    onCameraPick,
  },
  ref,
) {
  const onCameraPickRef = useRef(onCameraPick);
  useEffect(() => {
    onCameraPickRef.current = onCameraPick;
  }, [onCameraPick]);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const userMarker = useRef<Marker | null>(null);
  const ringLabel = useRef<Marker | null>(null);
  const drawUserRef = useRef<() => void>(() => {});
  const [visible, setVisible] = useState<Visible[]>([]);
  const [ready, setReady] = useState(false);
  const [painted, setPainted] = useState(false);
  // Bumps on every style load, so layers added by effects come back after a swap.
  const [styleEpoch, setStyleEpoch] = useState(0);
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
    fitTo(points) {
      const m = map.current;
      if (!m || points.length === 0) return false;
      let [w, so, e, n] = [180, 90, -180, -90];
      for (const p of points) {
        w = Math.min(w, p.lng);
        e = Math.max(e, p.lng);
        so = Math.min(so, p.lat);
        n = Math.max(n, p.lat);
      }
      m.fitBounds(
        [
          [w, so],
          [e, n],
        ],
        {
          padding: { top: 150, bottom: 170, left: 50, right: 80 },
          maxZoom: 14.5,
          pitch: m.getPitch() > 5 ? 45 : 0,
          bearing: m.getBearing(),
          duration: 1200,
        },
      );
      return true;
    },
  }));

  const emitViewport = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    const ne = m.getBounds().getNorthEast();
    const radiusMi = distanceMiles(
      { lat: c.lat, lng: c.lng },
      { lat: ne.lat, lng: ne.lng },
    );
    onViewport.current({
      center: { lat: c.lat, lng: c.lng },
      radiusMi: Math.min(50, Math.max(0.5, radiusMi)),
      zoom: m.getZoom(),
    });
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
      const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [
        number,
        number,
      ];
      const key = p.cluster ? `c${p.cluster_id}` : `p${p.id}`;
      if (next.has(key)) continue;
      let marker = markers.current.get(key);
      if (!marker) {
        const el = document.createElement("div");
        marker = new ml.Marker({ element: el, anchor: "bottom" })
          .setLngLat([lng, lat])
          .addTo(m);
        markers.current.set(key, marker);
      } else {
        marker.setLngLat([lng, lat]);
      }
      const el = marker.getElement();
      next.set(
        key,
        p.cluster
          ? {
              key,
              kind: "cluster",
              el,
              clusterId: Number(p.cluster_id),
              count: Number(p.point_count),
              maxSev: Number(p.maxSev ?? 0),
              lng,
              lat,
            }
          : {
              key,
              kind: "point",
              el,
              id: String(p.id),
              category: p.category as PublicIncident["category"],
              severity: Number(p.sevRank),
              ended: Boolean(p.ended),
              age: Number(p.age ?? 0),
              stormState: (p.stormState as StormState | undefined) || null,
              confirms: Number(p.confirms ?? 0),
              stormFadeValue: Number(p.stormFade ?? 1),
            },
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
        // Always visible (not collapsed) so the OpenStreetMap / OpenFreeMap credit is shown per license.
        attributionControl: { compact: true },
        fadeDuration: 0,
      });
      map.current = m;

      m.on("error", (e) => {
        // Only a failure of the style document itself warrants the fallback;
        // individual tile errors are retried by MapLibre.
        if (!fellBack && isStyleError(e.error, styleUrlFor(resolved.current))) {
          fellBack = true;
          console.warn(
            "[haven] map style failed, using fallback",
            e.error?.message,
          );
          m.setStyle(FALLBACK_RASTER_STYLE);
        }
      });
      m.on("style.load", () => {
        if (resolved.current === "night") tuneNightStyle(m);
        if (resolved.current === "day") tuneDayStyle(m);
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
            filter: [
              "all",
              ["!", ["has", "point_count"]],
              ["!", ["get", "ended"]],
            ],
            paint: {
              "circle-color": ["get", "color"],
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11,
                18,
                14,
                34,
                17,
                70,
              ],
              "circle-blur": 1,
              "circle-opacity": [
                "match",
                ["get", "sevRank"],
                3,
                0.5,
                2,
                0.4,
                1,
                0.3,
                0.2,
              ],
            },
          });
          // Invisible layer so the source's tiles load and can be queried.
          m.addLayer({
            id: "incidents-hit",
            type: "circle",
            source: SOURCE,
            paint: { "circle-opacity": 0, "circle-radius": 1 },
          });
        }
        addActivityLayer(m, "incidents-glow");
        (m.getSource(ACTIVITY) as GeoJSONSource | undefined)?.setData(
          activityGeoJson(latest.current),
        );
        // The colored glow under pins reads as light on the night map and as a
        // smudge on the day map, so it is nearly off there.
        m.setPaintProperty(
          "incidents-glow",
          "circle-opacity",
          resolved.current === "day"
            ? ["match", ["get", "sevRank"], 3, 0.16, 2, 0.12, 1, 0.08, 0.05]
            : ["match", ["get", "sevRank"], 3, 0.5, 2, 0.4, 1, 0.3, 0.2],
        );
        drawUserRef.current();
        // A style swap drops sources; restore the current incidents.
        (m.getSource(SOURCE) as GeoJSONSource).setData(
          toGeoJson(latest.current),
        );
        (m.getSource(BEACONS) as GeoJSONSource | undefined)?.setData(
          beaconGeoJson(latest.current),
        );
        setReady(true);
        setStyleEpoch((n) => n + 1);
        // Tiles arrive after "load"; keep the placeholder until the first full paint.
        const done = () => {
          setPainted(true);
          // The compact attribution opens itself once the sources are in; fold
          // it to the ⓘ (it still opens on tap, and shows in full when tapped).
          m.getContainer()
            .querySelector(".maplibregl-ctrl-attrib")
            ?.classList.remove("maplibregl-compact-show");
        };
        m.once("idle", done);
        setTimeout(done, 4000);
        emitViewport();
      });
      m.on("moveend", () => {
        syncMarkers();
        emitViewport();
        onCamera.current?.({ bearing: m.getBearing(), pitch: m.getPitch() });
      });
      m.on("rotate", () =>
        onCamera.current?.({ bearing: m.getBearing(), pitch: m.getPitch() }),
      );
      m.on("sourcedata", (e) => {
        if (e.sourceId === SOURCE && e.isSourceLoaded) syncMarkers();
      });
      m.on("click", (e) => {
        if ((e.originalEvent.target as HTMLElement).closest(".haven-marker"))
          return;
        if (m.getLayer(CAMERAS)) {
          const hit = m.queryRenderedFeatures(
            [
              [e.point.x - 12, e.point.y - 12],
              [e.point.x + 12, e.point.y + 12],
            ],
            { layers: [CAMERAS] },
          )[0];
          if (hit) {
            const [lng, lat] = (hit.geometry as GeoJSON.Point).coordinates;
            onCameraPickRef.current?.(hit.properties ?? {}, { lat, lng });
            return;
          }
        }
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
    (map.current?.getSource(BEACONS) as GeoJSONSource | undefined)?.setData(
      beaconGeoJson(incidents),
    );
    (map.current?.getSource(ACTIVITY) as GeoJSONSource | undefined)?.setData(
      activityGeoJson(incidents),
    );
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

  // User location dot and the 1-mile ring. Redrawn whenever the position or
  // the style changes (a style swap drops the ring's source and layers).
  useEffect(() => {
    drawUserRef.current = () => {
      const m = map.current;
      const ml = lib.current;
      const p = userPosition;
      if (!m || !ml || !m.isStyleLoaded()) return;
      if (!p) {
        userMarker.current?.remove();
        userMarker.current = null;
        ringLabel.current?.remove();
        ringLabel.current = null;
        return;
      }
      const day = resolved.current === "day";
      const ink = day ? "#111318" : "#ffffff";
      const ring = circlePolygon(p, RING_METERS);
      const ringSrc = m.getSource(RING) as GeoJSONSource | undefined;
      if (ringSrc) ringSrc.setData(ring);
      else {
        m.addSource(RING, { type: "geojson", data: ring });
        m.addLayer({
          id: `${RING}-fill`,
          type: "fill",
          source: RING,
          paint: { "fill-color": ink, "fill-opacity": day ? 0.035 : 0.05 },
        });
        m.addLayer({
          id: `${RING}-line`,
          type: "line",
          source: RING,
          paint: {
            "line-color": ink,
            "line-opacity": day ? 0.22 : 0.28,
            "line-width": 1.2,
          },
        });
      }
      if (!ringLabel.current) {
        const el = document.createElement("div");
        el.textContent = "1 mi";
        ringLabel.current = new ml.Marker({ element: el })
          .setLngLat([p.lng, ring.properties.topLat])
          .addTo(m);
      } else {
        ringLabel.current.setLngLat([p.lng, ring.properties.topLat]);
      }
      ringLabel.current.getElement().style.cssText = `pointer-events:none;color:${ink};opacity:.8;font:600 11px/1 system-ui;letter-spacing:.02em;text-shadow:0 1px 2px ${day ? "rgba(255,255,255,.9)" : "rgba(0,0,0,.8)"};transform:translateY(-8px)`;
      if (!userMarker.current) {
        const el = document.createElement("div");
        el.setAttribute("aria-label", "Your location");
        // Calm, like the big map apps: a crisp dot inside a faint accuracy halo.
        el.innerHTML =
          '<span style="position:absolute;inset:0;border-radius:9999px;background:rgba(61,139,255,.14)"></span>' +
          '<span style="position:absolute;inset:11px;border-radius:9999px;background:#3d8bff;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35)"></span>';
        el.style.cssText =
          "position:relative;width:44px;height:44px;pointer-events:none;z-index:4";
        userMarker.current = new ml.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .addTo(m);
      } else {
        userMarker.current.setLngLat([p.lng, p.lat]);
      }
    };
    if (ready) drawUserRef.current();
  }, [userPosition, ready]);

  // Marker containers are separate stacking contexts, so layer them here:
  // selected > severe > other incidents > clusters > the person's own dot.
  useEffect(() => {
    for (const v of visible) {
      const el = markers.current.get(v.key)?.getElement();
      if (el)
        el.style.zIndex =
          v.kind === "cluster"
            ? "5"
            : v.id === selectedId
              ? "30"
              : String(10 + v.severity);
    }
  }, [visible, selectedId]);

  // License plate reader cameras: a small square per camera, under the pins.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const data = cameras ?? { type: "FeatureCollection" as const, features: [] };
    const src = m.getSource(CAMERAS) as GeoJSONSource | undefined;
    if (src) src.setData(data);
    else {
      m.addSource(CAMERAS, { type: "geojson", data });
      m.addLayer(
        {
          id: CAMERAS,
          type: "circle",
          source: CAMERAS,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 14, 5, 17, 7],
            "circle-color": "#b48cff",
            "circle-stroke-color": resolved.current === "day" ? "#ffffff" : "#0b0c0f",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.95,
          },
        },
        m.getLayer("incidents-glow") ? "incidents-glow" : undefined,
      );
    }
    m.setLayoutProperty(CAMERAS, "visibility", cameras ? "visible" : "none");
  }, [cameras, ready, styleEpoch]);

  // Keep the selected incident visible above the preview sheet.
  useEffect(() => {
    const m = map.current;
    const inc = selectedId
      ? latest.current.find((i) => i.id === selectedId)
      : null;
    if (!m || !inc) return;
    const pt = m.project([inc.longitude, inc.latitude]);
    const h = m.getContainer().clientHeight;
    // Glide in toward the incident, like tapping a place in a maps app: at most
    // ~1.5 zoom levels closer, never past street level, never zooming out.
    const tilted = m.getPitch() > 5;
    const zoom = Math.max(m.getZoom(), Math.min(m.getZoom() + 1.5, 16.5));
    const move =
      zoom > m.getZoom() + 0.05 || tilted || pt.y > h * 0.42 || pt.y < 120;
    if (move) {
      m.easeTo({
        center: [inc.longitude, inc.latitude],
        offset: [0, -Math.round(h * 0.2)],
        zoom,
        pitch: tilted ? 62 : 0,
        duration: tilted ? 1100 : 650,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    }
  }, [selectedId]);

  const zoomIntoCluster = useCallback(
    async (clusterId: number, lng: number, lat: number) => {
      const m = map.current;
      const src = m?.getSource(SOURCE) as GeoJSONSource | undefined;
      if (!m || !src) return;
      const zoom = await src.getClusterExpansionZoom(clusterId);
      m.easeTo({
        center: [lng, lat],
        zoom: Math.min(zoom + 0.2, 17),
        duration: 650,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    },
    [],
  );

  return (
    <>
      {/* maplibre forces position:relative on its container, so size it from a wrapper. */}
      <div className="absolute inset-0 isolate">
        <div
          ref={container}
          className="h-full w-full"
          role="region"
          aria-label="Incident map"
        />
      </div>
      {!painted && !failed && (
        <div
          className="map-skeleton pointer-events-none absolute inset-0 transition-opacity duration-500"
          aria-hidden
        >
          <div className="haven-shimmer absolute inset-0 opacity-60" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg px-8 text-center text-muted">
          The map couldn&apos;t load. The Feed tab still shows nearby incidents.
        </div>
      )}
      {visible.map((v) =>
        createPortal(
          v.kind === "cluster" ? (
            <ClusterMarker
              count={v.count}
              maxSev={v.maxSev}
              onClick={() => zoomIntoCluster(v.clusterId, v.lng, v.lat)}
            />
          ) : v.stormState ? (
            <StormPin
              category={v.category}
              state={v.stormState}
              confirms={v.confirms}
              fade={v.stormFadeValue}
              selected={v.id === selectedId}
              onClick={() => onSelect(v.id)}
            />
          ) : (
            <PointMarker
              category={v.category}
              severity={v.severity}
              ended={v.ended}
              age={v.age}
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

/** A circle on the ground as a polygon; `topLat` is where its label goes. */
function circlePolygon(
  c: LatLng,
  meters: number,
): GeoJSON.Feature<GeoJSON.Polygon, { topLat: number }> {
  const dLat = (meters / 6_371_000) * (180 / Math.PI);
  const dLng = dLat / Math.max(0.01, Math.cos((c.lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    ring.push([c.lng + dLng * Math.cos(a), c.lat + dLat * Math.sin(a)]);
  }
  return {
    type: "Feature",
    properties: { topLat: c.lat + dLat },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

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
        // Hours old, for recency fading on the marker.
        age: (Date.now() - new Date(i.createdAt).getTime()) / 3_600_000,
        // Storm reports: state, neighbor confirmations, and 2h/6h fading by last activity.
        stormState: i.storm?.state ?? "",
        confirms: i.confirmationCount,
        stormFade: i.storm ? stormFade(i.updatedAt) : 1,
      },
    })),
  };
}

function PointMarker({
  category,
  severity,
  ended,
  age,
  selected,
  onClick,
}: {
  category: PublicIncident["category"];
  severity: number;
  ended: boolean;
  /** Hours since it was reported. */
  age: number;
  selected: boolean;
  onClick: () => void;
}) {
  const def = getCategory(category);
  const label = `${def.label}, ${["low", "moderate", "high", "critical"][severity] ?? "unknown"} severity${ended ? ", ended" : ""}`;
  const press = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  // Ended incidents recede to a small gray dot so live ones own the map.
  if (ended && !selected) {
    return (
      <button
        type="button"
        onClick={press}
        aria-label={label}
        className="haven-marker relative flex size-4 items-center justify-center"
      >
        <span className="size-3 rounded-full border-2 border-white/80 bg-[#6b7280] shadow-[0_1px_4px_rgba(0,0,0,.5)]" />
      </button>
    );
  }

  const color = ended ? "#6b7280" : def.color;
  // Recency: full strength for 2h, then fades gently (never below 75%) toward 24h.
  const fade = age <= 2 ? 1 : Math.max(0.75, 1 - ((age - 2) / 22) * 0.25);
  const size = selected
    ? 50
    : [38, 40, 42, 46][Math.max(0, Math.min(3, severity))];
  const live = age < 1 && severity >= 1;
  const mins = Math.round(age * 60);
  const when =
    mins < 60
      ? `${Math.max(1, mins)}m`
      : age < 24
        ? `${Math.round(age)}h`
        : `${Math.round(age / 24)}d`;
  return (
    <button
      type="button"
      onClick={press}
      aria-label={label}
      aria-pressed={selected}
      className="haven-marker haven-pop relative flex items-center justify-center"
      style={{
        width: size + 8,
        height: size + 8,
        opacity: selected ? 1 : fade,
      }}
    >
      {live && !selected && (
        <span
          className="haven-pulse absolute inset-0 rounded-full"
          style={{ background: "rgba(255,45,85,.45)" }}
          aria-hidden
        />
      )}
      {/* Dark disc with a thin ring in the category color; red ring while live. */}
      <span
        className="absolute inset-1 flex items-center justify-center rounded-full"
        style={{
          background: "#15181f",
          color,
          boxShadow: selected
            ? `0 0 0 3px ${color}, 0 0 0 8px color-mix(in srgb, ${color} 30%, transparent), 0 8px 20px rgba(0,0,0,.6)`
            : `0 0 0 2px ${live ? "#ff2d55" : `color-mix(in srgb, ${color} 70%, transparent)`}, 0 4px 12px rgba(0,0,0,.55)`,
          transition: "box-shadow 160ms",
        }}
      >
        <CategoryGlyph
          category={category}
          animated={false}
          style={{ width: size * 0.5, height: size * 0.5 }}
        />
      </span>
      {/* When it was reported, as a small tag on the rim. */}
      <span
        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-bold leading-[15px] text-white tnum"
        style={{
          background: live ? "#ff2d55" : "#2a2e38",
          boxShadow: "0 0 0 1.5px #0b0c0f",
        }}
        aria-hidden
      >
        {when}
      </span>
    </button>
  );
}

/**
 * A storm report pin: colored by what it says (flooded is big, red and
 * pulsing), with the number of neighbors who confirmed it.
 */
function StormPin({
  category,
  state,
  confirms,
  fade,
  selected,
  onClick,
}: {
  category: PublicIncident["category"];
  state: StormState;
  confirms: number;
  fade: number;
  selected: boolean;
  onClick: () => void;
}) {
  const style = STATE_STYLE[state];
  const flooded = state === "flooded";
  const size = selected ? 50 : flooded ? 46 : 38;
  const label = `${getCategory(category).label}: ${state}${confirms ? `, ${confirms} confirmed` : ""}`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      aria-pressed={selected}
      className="haven-marker haven-pop relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        opacity: selected ? 1 : Math.max(0.45, fade),
      }}
    >
      {flooded && (
        <span
          className="haven-pulse absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
          style={{
            width: size,
            height: size,
            background: "rgba(255,45,32,.55)",
          }}
          aria-hidden
        />
      )}
      <span
        className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: flooded ? "30%" : "9999px",
          // Same dark disc as every other pin; flooded streets stay solid red.
          background: flooded ? style.color : "#15181f",
          color: flooded ? "#fff" : style.color,
          boxShadow: selected
            ? `0 0 0 3px ${style.color}, 0 0 0 8px color-mix(in srgb, ${style.color} 30%, transparent), 0 8px 20px rgba(0,0,0,.6)`
            : `0 0 0 2px ${flooded ? "#fff" : `color-mix(in srgb, ${style.color} 75%, transparent)`}, 0 4px 12px rgba(0,0,0,.55)`,
        }}
      >
        <CategoryGlyph
          category={category}
          animated={false}
          style={{ width: size * 0.56, height: size * 0.56 }}
        />
        {/* Good news gets a check, bad news an x: readable without color. */}
        <span
          className="absolute -bottom-1 -left-1 flex size-[17px] items-center justify-center rounded-full bg-[#15181f] text-[10px] font-black leading-none text-white ring-[1.5px] ring-white/80"
          aria-hidden
        >
          {style.bad ? "✕" : "✓"}
        </span>
      </span>
      {confirms > 0 && (
        <span
          className="absolute -right-2 -top-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#0b0c0f] px-1 text-[11px] font-bold text-white ring-2 ring-white tnum"
          aria-hidden
        >
          {confirms}
        </span>
      )}
    </button>
  );
}

function ClusterMarker({
  count,
  maxSev,
  onClick,
}: {
  count: number;
  maxSev: number;
  onClick: () => void;
}) {
  const ring = ["#6b7280", "#f5b84b", "#ff8a5c", "#ff2d55"][
    Math.max(0, Math.min(3, maxSev))
  ];
  const size = count >= 50 ? 48 : count >= 10 ? 42 : 38;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${count} incidents here. Zoom in.`}
      className="haven-marker haven-pop flex items-center justify-center rounded-full bg-[#15181f] text-[14px] font-bold text-white tnum"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 2px ${ring}, 0 4px 12px rgba(0,0,0,.5)`,
      }}
    >
      {count}
    </button>
  );
}
