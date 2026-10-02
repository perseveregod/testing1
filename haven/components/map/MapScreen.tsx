"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Layers, ListChecks, LocateFixed, Navigation2, Search, SlidersHorizontal, X } from "lucide-react";
import { setStormPrefs, useStormPrefs, useStormReportTick } from "@/lib/client/stormMode";
import { peekMapFocus, takeMapFocus } from "@/lib/client/mapFocus";
import { setMapTone } from "@/lib/client/mapTone";
import { incidentTitle, useT } from "@/lib/client/lang";
import { dismissTip, useTip } from "@/lib/client/tips";
import type { Key } from "@/lib/i18n";
import { STATE_STYLE, strings, type StormKind } from "@/lib/storm";
import { STORM_CATEGORIES } from "@/lib/categories";
import { OfficialSourcesSheet } from "@/components/storm/StormBanner";
import { StormPrepSheet } from "@/components/storm/StormPrepSheet";
import { CameraSheet, type PickedCamera } from "@/components/map/CameraSheet";
import { useLayerPrefs } from "@/lib/client/layers";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { StormIcon } from "@/components/storm/StormIcon";
import { NearbyPeek } from "@/components/map/NearbyPeek";
import { useClock } from "@/lib/client/safewalk";
import { StormReportSheet } from "@/components/storm/StormReportSheet";
import { DEFAULT_CENTER, EMERGENCY_NUMBER } from "@/lib/client/defaults";
import { errorMessage } from "@/lib/client/api";
import { useArrivals } from "@/lib/client/arrivals";
import { distanceFrom, incidentsUrl, useHydrated, useIncidents, useNearYou, useViewer, type IncidentParams, type InitialIncidents } from "@/lib/client/hooks";
import { distanceMiles, formatDistance, type LatLng } from "@/lib/geo";
import { lastKnownPosition, useLocation } from "@/components/providers/LocationProvider";
import { IncidentPreview } from "@/components/incident/IncidentPreview";
import { getCategory, type FilterGroup } from "@/lib/categories";
import { Spinner } from "@/components/ui/States";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  FilterSheet,
  filterParams,
  type MapFilters,
} from "./FilterSheet";
import {
  IncidentMap,
  type Camera,
  type MapHandle,
  type Viewport,
} from "./IncidentMap";
import { LayersSheet } from "./LayersSheet";
import { BEARING_3D, PITCH_3D, resolveMode, type MapMode } from "./map3d";
import { SearchSheet } from "./SearchSheet";

const MODE_KEY = "haven.mapMode";

function savedMode(): MapMode {
  try {
    const v =
      typeof window === "undefined" ? null : localStorage.getItem(MODE_KEY);
    // Night is the default look; Automatic, Day and Satellite are opt-in.
    return v === "auto" || v === "day" || v === "satellite" ? v : "night";
  } catch {
    return "night";
  }
}

const PROMPT_KEY = "haven.locationPromptDismissed";
const OPENED_KEY = "haven.opened.v1";
const COLD_AFTER_MS = 15 * 60_000;

/** True once per cold open: the first time in a while, and the first time this page load asks. */
let coldOpenAnswer: boolean | null = null;
function coldOpen(): boolean {
  if (coldOpenAnswer != null) return coldOpenAnswer;
  if (typeof window === "undefined") return false;
  try {
    const last = Number(localStorage.getItem(OPENED_KEY) ?? 0);
    // The very first run belongs to the welcome screens, not the lights.
    const welcomed = localStorage.getItem("haven.welcomed.v1") === "1";
    coldOpenAnswer = welcomed && Date.now() - last > COLD_AFTER_MS;
    localStorage.setItem(OPENED_KEY, String(Date.now()));
  } catch {
    coldOpenAnswer = true;
  }
  return coldOpenAnswer;
}

function promptWasDismissed(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

/** One-tap category filters along the top of the map. */
const QUICK: { id: FilterGroup | null; label: Key; color?: string }[] = [
  { id: null, label: "common.all" },
  { id: "police", label: "map.group.police", color: getCategory("police").color },
  { id: "fire", label: "map.group.fire", color: getCategory("fire").color },
  { id: "medical", label: "map.group.medical", color: getCategory("medical").color },
  { id: "traffic", label: "map.group.traffic", color: getCategory("traffic_accident").color },
  { id: "weather", label: "map.group.weather", color: getCategory("severe_weather").color },
];

const RADIUS_BUCKETS = [1, 2, 5, 10, 25, 50];

/** Snap the viewport so small pans reuse the same query (and SWR cache). */
function queryArea(
  v: Viewport | null,
): { center: LatLng; radiusMi: number } | null {
  if (!v) return null;
  const radiusMi = RADIUS_BUCKETS.find((b) => b >= v.radiusMi * 1.15) ?? 50;
  const step = radiusMi <= 2 ? 0.005 : radiusMi <= 10 ? 0.02 : 0.1;
  return {
    center: {
      lat: Math.round(v.center.lat / step) * step,
      lng: Math.round(v.center.lng / step) * step,
    },
    radiusMi,
  };
}

/** A quick-filter pill over the map: panel material, solid when selected. */
function Chip({
  on,
  tint,
  className = "",
  children,
  ...rest
}: { on?: boolean; tint?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`press inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${
        on ? "bg-text text-bg" : tint ? "" : "panel text-text"
      } ${className}`}
      style={tint ? { background: tint, color: "#1b1300" } : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Round floating control over the map. 44 px, glass. */
function MapControl({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`press flex size-11 items-center justify-center text-text ${className}`}
    >
      {children}
    </button>
  );
}

export function MapScreen({ initial, active = true }: { initial?: InitialIncidents | null; active?: boolean }) {
  const mapRef = useRef<MapHandle>(null);
  const { position, lastPosition, status, request } = useLocation();
  const { viewer } = useViewer();
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  // Optional layers. Cameras come from OpenStreetMap, 25 mi around the default area.
  const layerPrefs = useLayerPrefs();
  const [pickedCamera, setPickedCamera] = useState<PickedCamera | null>(null);
  const camCenter = useMemo(() => lastPosition ?? DEFAULT_CENTER, [lastPosition]);
  // A static snapshot rendered at build time and refreshed every few hours
  // (app/layers/alpr-houston): instant, never waits on Overpass.
  const { data: camData } = useSWR<{ cameras: { id: string; lat: number; lng: number; operator: string | null; manufacturer: string | null; direction: number | null; note: string | null }[]; updatedAt: string | null }>(
    layerPrefs.cameras ? "/layers/alpr-houston" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 },
  );
  const cameraGeo = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!layerPrefs.cameras || !camData) return null;
    // Only what's within 30 mi of the person (or downtown): keeps the layer light.
    const near = camData.cameras.filter((c) => distanceMiles(camCenter, { lat: c.lat, lng: c.lng }) <= 30);
    return {
      type: "FeatureCollection",
      features: near.map((c) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
        properties: { operator: c.operator, manufacturer: c.manufacturer, direction: c.direction, note: c.note },
      })),
    };
  }, [layerPrefs.cameras, camData, camCenter]);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [searchLabel, setSearchLabel] = useState<string | null>(() => peekMapFocus()?.label ?? null);
  const [promptDismissed] = useState(promptWasDismissed);
  const [mode, setMode] = useState<MapMode>(savedMode);
  const [layersOpen, setLayersOpen] = useState(false);
  const [camera, setCamera] = useState<Camera>({
    bearing: BEARING_3D,
    pitch: PITCH_3D,
  });

  const chooseMode = useCallback((m: MapMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  }, []);
  const flewToUser = useRef(false);
  // Cold start: open from above with the city's lights blinking on, then fly
  // in. A reopen within 15 minutes skips it and lands on you at once.
  const [intro] = useState(() => coldOpen());
  const [introDone, setIntroDone] = useState(() => !coldOpen());
  const [lit, setLit] = useState<number | null>(null);
  const onLights = useCallback((n: number | null) => setLit(n), []);
  const onIntroDone = useCallback(() => setIntroDone(true), []);

  const storm = useStormPrefs();
  const st = strings(storm.lang);
  const { t, lang } = useT();
  const [stormFilter, setStormFilter] = useState<StormKind | null>(null);
  // Storm reports open from the tab bar's center button (see requestStormReport).
  const reportTick = useStormReportTick();
  const [reportClosedAt, setReportClosedAt] = useState(0);
  const stormReportOpen = storm.on && reportTick > reportClosedAt;

  const area = useMemo(() => queryArea(viewport), [viewport]);
  // The remembered position isn't known until hydration is over; asking for
  // downtown in the meantime would be a wasted download.
  const hydrated = useHydrated();
  // The count in the status chip is the shared "near you" number every tab
  // uses. Where the person last was stands in for the live fix, so the count
  // and the first pins are already their part of town, straight from the
  // copy kept on this device.
  const near = useNearYou(hydrated ? (lastPosition ?? DEFAULT_CENTER) : null, initial);
  const viewportParams: IncidentParams = storm.on
    ? {
        // Storm Mode: only power / flooding / place reports from the last 6 hours.
        center: area?.center ?? DEFAULT_CENTER,
        radiusMi: Math.max(area?.radiusMi ?? 10, 10),
        categories: stormFilter ? [stormFilter] : STORM_CATEGORIES,
        sinceHours: 6,
        includeResolved: false,
      }
    : {
        // Nothing until the map reports a viewport: the "near you" answer
        // covers the first frame (it's a superset of what's in view).
        center: area?.center ?? null,
        radiusMi: area?.radiusMi ?? 5,
        ...filterParams(filters, viewer),
      };
  const viewportQuery = useIncidents(viewportParams, storm.on ? null : initial);
  const { isLoading, isValidating, error, mutate } = viewportQuery;
  const fromNear = !storm.on && !area;
  const items = fromNear ? near.items : viewportQuery.items;
  // Which query the pins come from: a new answer to the same question is
  // news (ripples); a different question (pan, zoom, filter) is not.
  const itemsKey = fromNear ? "near" : (incidentsUrl(viewportParams) ?? "");
  // Something new within 5 mi gets a few seconds as a chip under the filters
  // (the ring on its pin may be off screen); tapping it goes there.
  const { arrived } = useArrivals(near.items, { scrolled: false });
  const arrival = useMemo(() => {
    const fresh = near.items.filter((i) => arrived.has(i.id) && i.status !== "resolved");
    return fresh.sort((a, b) => (distanceFrom(lastPosition, a) ?? 0) - (distanceFrom(lastPosition, b) ?? 0))[0] ?? null;
  }, [near.items, arrived, lastPosition]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [bottomH, setBottomH] = useState(0);
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBottomH(Math.round(e!.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const now = Math.floor(useClock(true) / 30_000) * 30_000;
  // An official weather alert in view: offer Storm Mode.
  const weatherAlert = !storm.on && items.some((i) => i.source.kind === "weather" && i.status !== "resolved");

  // Without the person's location, open framed on what's live right now
  // instead of an empty downtown view. Runs once, on the first data.
  // Framed once per mode, so turning Storm Mode on or off re-frames the map.
  const framed = useRef<Record<string, boolean>>({});
  const frameKey = storm.on ? "storm" : "all";
  useEffect(() => {
    // Normal mode with location: the map flies to you instead (below).
    if (!introDone || framed.current[frameKey] || (position && !storm.on) || items.length === 0) return;
    let live = items.filter((i) => i.status !== "resolved");
    // Storm Mode with location: frame you plus the closest reports around you.
    if (storm.on && position) {
      live = [...live]
        .sort((a, b) => (distanceFrom(position, a) ?? 0) - (distanceFrom(position, b) ?? 0))
        .slice(0, 6);
    }
    if (live.length === 0) return;
    const points = live.map((i) => ({ lat: i.latitude, lng: i.longitude }));
    if (storm.on && position) points.push(position);
    if (mapRef.current?.fitTo(points)) framed.current[frameKey] = true;
  }, [items, position, viewport, frameKey, storm.on, introDone]);

  // "On the map" from another tab (e.g. a campus): go there instead of framing.
  useEffect(() => {
    if (!viewport || !peekMapFocus()) return;
    const f = takeMapFocus();
    if (!f) return;
    flewToUser.current = true;
    framed.current.all = true;
    mapRef.current?.flyTo(f.point, 15);
  }, [viewport]);

  // Jump to the person's location the first time we learn it (a long, slow
  // descent right after the lights; the usual quick hop otherwise).
  useEffect(() => {
    if (introDone && position && !flewToUser.current) {
      flewToUser.current = true;
      mapRef.current?.flyTo(position, 14, { duration: 1800 });
    }
  }, [position, introDone]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  // First visit: one line under the chips until a pin is tapped.
  const pinTip = useTip("pin") && !storm.on && items.length > 0;
  useEffect(() => {
    if (selectedId) dismissTip("pin");
  }, [selectedId]);
  const filterCount = activeFilterCount(filters);
  const activeCount = items.filter((i) => i.status !== "resolved").length;
  const allDemo = items.length > 0 && items.every((i) => i.isDemo);

  const locate = useCallback(() => {
    if (position) mapRef.current?.flyTo(position, 15);
    else request();
  }, [position, request]);

  const showPrompt =
    !storm.on &&
    !selected &&
    !position &&
    !promptDismissed &&
    // Only offer when the browser can still ask. When it's blocked, the locate
    // button and the welcome screens explain it; no nagging card on the map.
    status === "prompt";

  const loading = isLoading || (isValidating && !items.length);

  // The chrome follows the map: light panels over the day style.
  // Decided on the client only (now is 0 during server render and hydration).
  const tone = now > 0 && resolveMode(mode, new Date(now)) === "day" ? "light" : "dark";
  useEffect(() => {
    setMapTone(tone);
    return () => setMapTone("dark");
  }, [tone]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg" data-tone={tone} style={{ "--map-bottom-inset": `${bottomH}px` } as React.CSSProperties}>
      <IncidentMap
        ref={mapRef}
        incidents={items}
        incidentsKey={itemsKey}
        selectedId={selectedId}
        onSelect={setSelectedId}
        userPosition={position}
        initialCenter={lastPosition ?? DEFAULT_CENTER}
        startFrom={lastKnownPosition}
        cameras={cameraGeo}
        onCameraPick={(props, at) =>
          setPickedCamera({
            operator: (props.operator as string | null) ?? null,
            manufacturer: (props.manufacturer as string | null) ?? null,
            direction: typeof props.direction === "number" ? props.direction : null,
            note: (props.note as string | null) ?? null,
            lat: at.lat,
            lng: at.lng,
          })
        }
        onViewportChange={setViewport}
        mode={mode}
        onCameraChange={setCamera}
        intro={intro}
        active={active}
        onLights={onLights}
        onIntroDone={onIntroDone}
      />
      {/* Soft gradients so the controls read over the map. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-bg/70 to-transparent"
        aria-hidden
      />

      {/* Top: one search pill, then loose chips. Nothing else over the map. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4"
        style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}
      >
        <div className="mx-auto max-w-lg">
          <div className="panel pointer-events-auto flex h-11 items-center gap-1 rounded-full pl-1 pr-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="press flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-full pl-3 text-left"
            >
              <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
              <span className={`truncate text-[15px] ${searchLabel ? "text-text" : "text-muted"}`}>
                {searchLabel ?? t("map.search")}
              </span>
            </button>
            <button
              type="button"
              aria-label={storm.on ? `${st.stormMode}: ${st.on}` : `${st.stormMode}: ${st.off}`}
              aria-pressed={storm.on}
              onClick={() => {
                setSelectedId(null);
                setStormPrefs({ on: !storm.on });
              }}
              className={`press flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                storm.on ? "bg-[#ffc233] text-[#1b1300]" : "text-muted hover:text-text"
              }`}
            >
              <StormIcon className="size-[21px]" active={storm.on} bolt={storm.on ? "#1b1300" : "#FFC233"} />
            </button>
          </div>

          <div
            className="no-scrollbar pointer-events-auto -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-2 pt-2"
            role="toolbar"
            aria-label={storm.on ? st.stormMode : t("map.quickFilters")}
          >
            {storm.on ? (
              <>
                <Chip onClick={() => setSourcesOpen(true)} tint="#ffc233" aria-label={st.officialSources}>
                  <StormIcon className="size-4" active bolt="#1b1300" cloud="#1b1300" />
                  {st.bannerShort} · {st.officialSourcesShort}
                </Chip>
                {([null, "power", "flooding", "place"] as (StormKind | null)[]).map((k) => {
                  const dot = k === "power" ? STATE_STYLE.out.color : k === "flooding" ? STATE_STYLE.flooded.color : k === "place" ? STATE_STYLE.open.color : null;
                  return (
                    <Chip key={k ?? "all"} on={stormFilter === k} onClick={() => setStormFilter(k)}>
                      {dot && <span className="size-2 rounded-full" style={{ background: dot }} aria-hidden />}
                      {k ? st[`kind_${k}`] : st.filterAll}
                    </Chip>
                  );
                })}
                <Chip onClick={() => setPrepOpen(true)}>
                  <ListChecks className="size-3.5" aria-hidden />
                  {t("map.prepare")}
                </Chip>
                <a href={`tel:${EMERGENCY_NUMBER}`} className="press inline-flex h-9 shrink-0 items-center rounded-full bg-live px-3.5 text-[13px] font-bold text-white">
                  {EMERGENCY_NUMBER}
                </a>
              </>
            ) : (
              <>
                <Chip on={filterCount > 0} onClick={() => setFilterOpen(true)} aria-label={`${t("map.allFilters")}${filterCount ? ` (${t("map.filtersActive", { n: filterCount })})` : ""}`}>
                  <SlidersHorizontal className="size-3.5" aria-hidden />
                  {filterCount > 0 ? `${t("map.filters")} · ${filterCount}` : t("map.filters")}
                  <ChevronDown className="size-3.5 opacity-60" aria-hidden />
                </Chip>
                {QUICK.map((q) => {
                  const on = q.id === null ? filters.groups.length === 0 : filters.groups.length === 1 && filters.groups[0] === q.id;
                  return (
                    <Chip key={q.label} on={on} onClick={() => setFilters((f) => ({ ...f, groups: q.id === null ? [] : [q.id] }))}>
                      {q.color && <span className="size-2 rounded-full" style={{ background: q.color }} aria-hidden />}
                      {t(q.label)}
                    </Chip>
                  );
                })}
              </>
            )}
          </div>

          {arrival && !storm.on && !selected && (
            <div className="pointer-events-auto flex">
              <button
                onClick={() => {
                  setSelectedId(arrival.id);
                  mapRef.current?.flyTo({ lat: arrival.latitude, lng: arrival.longitude }, 15);
                }}
                className="panel haven-rise inline-flex min-h-10 max-w-full items-center gap-2 rounded-full py-1 pl-3 pr-3.5 text-[13px] font-medium"
              >
                <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">{t("map.newNearby")}</span>
                <span className="truncate">{incidentTitle(arrival, lang)}</span>
                {distanceFrom(lastPosition, arrival) != null && (
                  <span className="shrink-0 text-muted tnum">{formatDistance(distanceFrom(lastPosition, arrival))}</span>
                )}
              </button>
            </div>
          )}
          {pinTip && !weatherAlert && !arrival && (
            <div className="pointer-events-auto flex">
              <button
                onClick={() => dismissTip("pin")}
                className="panel haven-rise inline-flex min-h-10 items-center gap-2 rounded-full py-1 pl-3.5 pr-3 text-[13px] font-medium text-muted"
              >
                <span className="relative flex size-2.5" aria-hidden>
                  <span className="haven-pulse absolute inset-0 rounded-full bg-live" />
                  <span className="relative size-2.5 rounded-full bg-live" />
                </span>
                {t("map.pinTip")}
                <X className="size-3.5 opacity-60" aria-hidden />
              </button>
            </div>
          )}
          {weatherAlert && (
            <div className="pointer-events-auto flex">
              {/* One line, one tap: the whole pill turns Storm Mode on. */}
              <button
                type="button"
                onClick={() => setStormPrefs({ on: true })}
                className="press inline-flex min-h-10 max-w-full items-center gap-2 rounded-full py-1 pl-3 pr-3.5 text-[13px] font-semibold text-[#1b1300]"
                style={{ background: "#ffc233", boxShadow: "0 6px 24px -10px rgba(0,0,0,.45)" }}
              >
                <StormIcon className="size-5 shrink-0" active bolt="#1b1300" cloud="#1b1300" />
                <span className="truncate">{st.suggestShort}</span>
                <ChevronRight className="size-4 shrink-0 opacity-70" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: map controls. Pinned above the tab bar; they step aside while a card is up. */}
      {!selected && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 bottom-nav-offset transition-transform duration-300"
          style={{ transform: `translateY(-${bottomH}px)` }}
        >
          <div className="mx-auto flex max-w-lg justify-end px-4 pb-3">
            <div className="pointer-events-auto flex flex-col items-end gap-2.5">
              <MapControl label={t("map.style")} onClick={() => setLayersOpen(true)} className="panel rounded-full">
                <Layers className="size-[18px]" aria-hidden />
              </MapControl>
              {Math.abs(camera.bearing - (camera.pitch > 5 ? BEARING_3D : 0)) > 2 && (
                <MapControl label={t("map.north")} onClick={() => mapRef.current?.resetNorth()} className="panel haven-pop rounded-full">
                  <Navigation2
                    className="size-[16px] fill-live text-live transition-transform duration-150"
                    style={{ transform: `rotate(${-camera.bearing}deg)` }}
                    aria-hidden
                  />
                </MapControl>
              )}
              <MapControl
                label={position ? t("map.center") : t("common.useMyLocation")}
                onClick={locate}
                className="panel rounded-full"
              >
                {status === "locating" ? (
                  <Spinner className="size-[18px]" />
                ) : (
                  <LocateFixed
                    className={`size-[18px] ${position ? "text-brand" : ""}`}
                    aria-hidden
                  />
                )}
              </MapControl>
            </div>
          </div>
        </div>
      )}

      {/* Bottom: incident preview or the one-time location prompt */}
      <div className="pointer-events-none absolute inset-x-0 z-30 bottom-nav-offset">
        <div ref={bottomRef} className="mx-auto max-w-lg px-4 pb-3">
          {!selected && (
            <div className="mb-2">
              <NearbyPeek
                items={storm.on ? items : near.items}
                activeCount={storm.on ? activeCount : lit == null ? near.activeCount : Math.round((near.activeCount * lit) / Math.max(1, activeCount))}
                loading={storm.on ? loading : near.isLoading}
                error={storm.on ? (error ? errorMessage(error) : null) : near.error ? errorMessage(near.error) : null}
                onRetry={() => (storm.on ? mutate() : near.mutate())}
                allDemo={storm.on ? allDemo : near.items.length > 0 && near.items.every((i) => i.isDemo)}
                position={position}
                now={now}
                onPick={setSelectedId}
                onLocate={showPrompt ? request : null}
                storm={storm.on ? { lang: storm.lang } : null}
              />
            </div>
          )}
          <IncidentPreview
            incident={selected}
            distanceMi={selected ? distanceFrom(position, selected) : null}
            onClose={() => setSelectedId(null)}
            onChanged={() => mutate()}
          />

        </div>
      </div>

      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        near={position ?? viewport?.center ?? DEFAULT_CENTER}
        onPick={(p, label) => {
          setSearchLabel(label);
          setSelectedId(null);
          mapRef.current?.flyTo(p, 15);
        }}
      />
      <StormReportSheet
        open={stormReportOpen}
        onClose={() => setReportClosedAt(reportTick)}
        mapCenter={viewport?.center ?? null}
        myPosition={position}
        onSent={(id) => {
          void mutate().then(() => setSelectedId(id));
        }}
      />
      <OfficialSourcesSheet open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
      <StormPrepSheet open={prepOpen} onClose={() => setPrepOpen(false)} />
      <CameraSheet camera={pickedCamera} onClose={() => setPickedCamera(null)} />
      <LayersSheet
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        value={mode}
        onChange={chooseMode}
        tilted={camera.pitch > 5}
        onToggle3D={() => mapRef.current?.toggle3D()}
      />
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onChange={setFilters}
        viewer={viewer}
      />
    </div>
  );
}
