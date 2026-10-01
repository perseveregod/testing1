"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Layers,
  LocateFixed,
  Navigation2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { setStormPrefs, useStormPrefs } from "@/lib/client/stormMode";
import { peekMapFocus, takeMapFocus } from "@/lib/client/mapFocus";
import { STATE_STYLE, strings, type StormKind } from "@/lib/storm";
import { STORM_CATEGORIES } from "@/lib/categories";
import { StormBanner } from "@/components/storm/StormBanner";
import { StormIcon } from "@/components/storm/StormIcon";
import { NearbyPeek } from "@/components/map/NearbyPeek";
import { useClock } from "@/lib/client/safewalk";
import { StormReportSheet } from "@/components/storm/StormReportSheet";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { errorMessage } from "@/lib/client/api";
import { distanceFrom, useIncidents, useNearYou, useViewer, type InitialIncidents } from "@/lib/client/hooks";
import type { LatLng } from "@/lib/geo";
import { useLocation } from "@/components/providers/LocationProvider";
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
import { BEARING_3D, PITCH_3D, type MapMode } from "./map3d";
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

function promptWasDismissed(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

/** One-tap category filters along the top of the map. */
const QUICK: { id: FilterGroup | null; label: string; color?: string }[] = [
  { id: null, label: "All" },
  { id: "police", label: "Police", color: getCategory("police").color },
  { id: "fire", label: "Fire", color: getCategory("fire").color },
  { id: "medical", label: "Medical", color: getCategory("medical").color },
  {
    id: "traffic",
    label: "Traffic",
    color: getCategory("traffic_accident").color,
  },
  {
    id: "weather",
    label: "Weather",
    color: getCategory("severe_weather").color,
  },
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

export function MapScreen({ initial }: { initial?: InitialIncidents | null }) {
  const mapRef = useRef<MapHandle>(null);
  const { position, status, request } = useLocation();
  const { viewer } = useViewer();
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
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

  const storm = useStormPrefs();
  const st = strings(storm.lang);
  const [stormFilter, setStormFilter] = useState<StormKind | null>(null);
  const [stormReportOpen, setStormReportOpen] = useState(false);

  const area = useMemo(() => queryArea(viewport), [viewport]);
  const { items, isLoading, isValidating, error, mutate } = useIncidents(
    storm.on
      ? {
          // Storm Mode: only power / flooding / place reports from the last 6 hours.
          center: area?.center ?? DEFAULT_CENTER,
          radiusMi: Math.max(area?.radiusMi ?? 10, 10),
          categories: stormFilter ? [stormFilter] : STORM_CATEGORIES,
          sinceHours: 6,
          includeResolved: false,
        }
      : {
          // Before the map reports a viewport, ask for the default area so the
          // server-rendered incidents apply from the first paint.
          center: area?.center ?? DEFAULT_CENTER,
          radiusMi: area?.radiusMi ?? 5,
          ...filterParams(filters, viewer),
        },
    storm.on ? null : initial,
  );
  // The count in the status chip is the shared "near you" number every tab uses.
  const near = useNearYou(position ?? DEFAULT_CENTER, initial);
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
    if (framed.current[frameKey] || (position && !storm.on) || items.length === 0) return;
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
  }, [items, position, viewport, frameKey, storm.on]);

  // "On the map" from another tab (e.g. a campus): go there instead of framing.
  useEffect(() => {
    if (!viewport || !peekMapFocus()) return;
    const f = takeMapFocus();
    if (!f) return;
    flewToUser.current = true;
    framed.current.all = true;
    mapRef.current?.flyTo(f.point, 15);
  }, [viewport]);

  // Jump to the person's location the first time we learn it.
  useEffect(() => {
    if (position && !flewToUser.current) {
      flewToUser.current = true;
      mapRef.current?.flyTo(position, 14);
    }
  }, [position]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
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

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <IncidentMap
        ref={mapRef}
        incidents={items}
        selectedId={selectedId}
        onSelect={setSelectedId}
        userPosition={position}
        initialCenter={DEFAULT_CENTER}
        onViewportChange={setViewport}
        mode={mode}
        onCameraChange={setCamera}
      />
      {/* Soft gradients so the controls read over the map. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-bg/85 via-bg/35 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg/85 via-bg/35 to-transparent"
        aria-hidden
      />

      {/* Top: search, filters, one status line, quick chips */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3"
        style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}
      >
        <div className="pointer-events-auto mx-auto max-w-lg rounded-[22px] bg-[#0f1116]/92 p-2 shadow-[0_8px_30px_-10px_rgba(0,0,0,.8),inset_0_0_0_0.5px_rgba(255,255,255,.08)] backdrop-blur-xl">
        <div className="flex h-11 items-center gap-1 rounded-[14px] bg-white/[0.07] pr-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="press flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[14px] pl-3.5 pr-2 text-left"
          >
            <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
            <span className={`truncate text-[15.5px] ${searchLabel ? "text-text" : "text-muted"}`}>
              {searchLabel ?? "Search location…"}
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
            className={`press relative flex size-10 shrink-0 items-center justify-center rounded-full ${
              storm.on ? "storm-on text-white" : "text-text"
            }`}
          >
            <StormIcon className="size-[22px]" active={storm.on} bolt={storm.on ? "#FFD34D" : "#FFC233"} />
          </button>
        </div>
        <div
          className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pt-2"
          role="toolbar"
          aria-label="Quick filters"
        >
          {!storm.on && (
            <button
              onClick={() => setFilterOpen(true)}
              aria-label={`All filters${filterCount ? ` (${filterCount} active)` : ""}`}
              className={`press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${
                filterCount > 0 ? "bg-text text-bg" : "bg-white/[0.07] text-text"
              }`}
            >
              <SlidersHorizontal className="size-3.5" aria-hidden />
              {filterCount > 0 ? `Filters · ${filterCount}` : "Incidents"}
              <ChevronDown className="size-3.5 opacity-70" aria-hidden />
            </button>
          )}
          {storm.on &&
            ([null, "power", "flooding", "place"] as (StormKind | null)[]).map((k) => {
              const on = stormFilter === k;
              const dot = k === "power" ? STATE_STYLE.out.color : k === "flooding" ? STATE_STYLE.flooded.color : k === "place" ? STATE_STYLE.open.color : null;
              return (
                <button
                  key={k ?? "all"}
                  aria-pressed={on}
                  onClick={() => setStormFilter(k)}
                  className={`press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${
                    on ? "bg-text text-bg" : "bg-white/[0.07] text-text"
                  }`}
                >
                  {dot && <span className="size-2 rounded-full" style={{ background: dot }} aria-hidden />}
                  {k ? st[`kind_${k}`] : st.filterAll}
                </button>
              );
            })}
          {!storm.on && QUICK.map((q) => {
            const on =
              q.id === null
                ? filters.groups.length === 0
                : filters.groups.length === 1 && filters.groups[0] === q.id;
            return (
              <button
                key={q.label}
                aria-pressed={on}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    groups: q.id === null ? [] : [q.id],
                  }))
                }
                className={`press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${
                  on ? "bg-white text-[#0b0c0f]" : "bg-white/[0.07] text-text"
                }`}
              >
                {q.color && (
                  <span
                    className="size-2 rounded-full"
                    style={{ background: q.color }}
                    aria-hidden
                  />
                )}
                {q.label}
              </button>
            );
          })}
        </div>
        </div>

        {storm.on && (
          <div className="mx-auto mt-2 max-w-lg px-1">
            <StormBanner />
          </div>
        )}
        {weatherAlert && (
          <div className="pointer-events-auto mx-auto mt-2 flex max-w-lg px-4">
            <div className="glass inline-flex min-h-11 items-center gap-2 rounded-full py-1 pl-3.5 pr-1 text-[13px] font-semibold">
              <StormIcon className="size-5" active bolt="#FFC233" />
              <span>{st.suggest}</span>
              <button
                onClick={() => setStormPrefs({ on: true })}
                className="press inline-flex min-h-9 items-center rounded-full bg-[#ff2d20] px-3 text-[12.5px] font-bold text-white"
              >
                {st.turnOn}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: map controls. Pinned above the tab bar; they step aside while a card is up. */}
      {!selected && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 bottom-nav-offset transition-transform duration-300"
          style={{ transform: `translateY(-${bottomH}px)` }}
        >
          <div className="mx-auto flex max-w-lg justify-end px-4 pb-3">
            <div className="pointer-events-auto flex flex-col items-end gap-2.5">
              <MapControl label="Map style" onClick={() => setLayersOpen(true)} className="glass rounded-full">
                <Layers className="size-[18px]" aria-hidden />
              </MapControl>
              {Math.abs(camera.bearing - (camera.pitch > 5 ? BEARING_3D : 0)) > 2 && (
                <MapControl label="Point the map north" onClick={() => mapRef.current?.resetNorth()} className="glass haven-pop rounded-full">
                  <Navigation2
                    className="size-[16px] fill-live text-live transition-transform duration-150"
                    style={{ transform: `rotate(${-camera.bearing}deg)` }}
                    aria-hidden
                  />
                </MapControl>
              )}
              <MapControl
                label={position ? "Center on my location" : "Use my location"}
                onClick={locate}
                className="glass rounded-full"
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
                activeCount={storm.on ? activeCount : near.activeCount}
                loading={storm.on ? loading : near.isLoading}
                error={storm.on ? (error ? errorMessage(error) : null) : near.error ? errorMessage(near.error) : null}
                onRetry={() => (storm.on ? mutate() : near.mutate())}
                allDemo={storm.on ? allDemo : near.items.length > 0 && near.items.every((i) => i.isDemo)}
                position={position}
                now={now}
                onPick={setSelectedId}
                onLocate={showPrompt ? request : null}
                storm={storm.on ? { lang: storm.lang, onReport: () => setStormReportOpen(true) } : null}
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
        onClose={() => setStormReportOpen(false)}
        mapCenter={viewport?.center ?? null}
        myPosition={position}
        onSent={(id) => {
          void mutate().then(() => setSelectedId(id));
        }}
      />
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
