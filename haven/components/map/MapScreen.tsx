"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Layers,
  LocateFixed,
  Navigation,
  Navigation2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { distanceFrom, useIncidents, useViewer, type InitialIncidents } from "@/lib/client/hooks";
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
    return v === "night" || v === "day" || v === "satellite" ? v : "auto";
  } catch {
    return "auto";
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
  const [searchLabel, setSearchLabel] = useState<string | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);
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

  const area = useMemo(() => queryArea(viewport), [viewport]);
  const { items, isLoading, isValidating, error, mutate } = useIncidents(
    {
      // Before the map reports a viewport, ask for the default area so the
      // server-rendered incidents apply from the first paint.
      center: area?.center ?? DEFAULT_CENTER,
      radiusMi: area?.radiusMi ?? 5,
      ...filterParams(filters, viewer),
    },
    initial,
  );

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
    !selected &&
    !position &&
    !promptDismissed &&
    (status === "prompt" || status === "denied" || status === "unavailable");

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
        className="pointer-events-none absolute inset-x-0 top-0 z-20"
        style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}
      >
        <div className="pointer-events-auto mx-auto flex max-w-lg gap-2 px-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="glass press flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 text-left"
          >
            <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
            <span
              className={`truncate text-[15.5px] ${searchLabel ? "text-text" : "text-muted"}`}
            >
              {searchLabel ?? "Search a place"}
            </span>
          </button>
          <button
            type="button"
            aria-label={`Filters${filterCount ? ` (${filterCount} active)` : ""}`}
            onClick={() => setFilterOpen(true)}
            className="glass press relative flex size-12 shrink-0 items-center justify-center rounded-full text-text"
          >
            <SlidersHorizontal className="size-[18px]" aria-hidden />
            {filterCount > 0 && (
              <span className="haven-pop absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-text text-[10px] font-bold text-bg tnum ring-2 ring-bg">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        <div
          className="no-scrollbar pointer-events-auto mx-auto mt-2 flex max-w-lg items-center gap-2 overflow-x-auto px-4 py-1"
          role="toolbar"
          aria-label="Quick filters"
        >
          {QUICK.map((q) => {
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
                className={`press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${
                  on ? "bg-text text-bg" : "glass text-text"
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

        {/* Status: what the map is showing, and whether it is real. */}
        <div className="pointer-events-auto mx-auto mt-1 flex max-w-lg px-4">
          <p
            className="inline-flex h-7 items-center gap-2 rounded-full bg-bg/70 px-3 text-[12px] font-medium text-muted backdrop-blur-md tnum"
            aria-live="polite"
          >
            {loading ? (
              <>
                <Spinner className="size-3" /> Loading incidents
              </>
            ) : error ? (
              <button onClick={() => mutate()} className="text-danger">
                Couldn&apos;t load · Retry
              </button>
            ) : (
              <>
                <span
                  className={`size-1.5 rounded-full ${activeCount > 0 ? "bg-live" : "bg-ok"}`}
                  aria-hidden
                />
                <span>
                  {activeCount} active · last 24h
                </span>
                {allDemo && (
                  <span className="rounded-[4px] bg-white/[0.1] px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text/80">
                    Demo data
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Right: map controls. Pinned above the tab bar; they step aside while a card is up. */}
      {!selected && !showPrompt && (
        <div className="pointer-events-none absolute inset-x-0 z-20 bottom-nav-offset">
          <div className="mx-auto flex max-w-lg justify-end px-4 pb-3">
            <div className="pointer-events-auto flex flex-col items-end gap-2.5">
              <div className="glass flex flex-col overflow-hidden rounded-[18px]">
                <MapControl label="Map style" onClick={() => setLayersOpen(true)}>
                  <Layers className="size-[18px]" aria-hidden />
                </MapControl>
                <span className="mx-2.5 h-px bg-line-strong" aria-hidden />
                <MapControl
                  label={camera.pitch > 5 ? "Switch to flat 2D view" : "Switch to 3D view"}
                  onClick={() => mapRef.current?.toggle3D()}
                  className="text-[12.5px] font-bold tracking-[0.02em]"
                >
                  {camera.pitch > 5 ? "2D" : "3D"}
                </MapControl>
                {Math.abs(camera.bearing) > 2 && (
                  <>
                    <span className="mx-2.5 h-px bg-line-strong" aria-hidden />
                    <MapControl label="Point the map north" onClick={() => mapRef.current?.resetNorth()} className="haven-pop">
                      <Navigation2
                        className="size-[16px] fill-live text-live transition-transform duration-150"
                        style={{ transform: `rotate(${-camera.bearing}deg)` }}
                        aria-hidden
                      />
                    </MapControl>
                  </>
                )}
              </div>
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
        <div className="mx-auto max-w-lg px-4 pb-3">
          <IncidentPreview
            incident={selected}
            distanceMi={selected ? distanceFrom(position, selected) : null}
            onClose={() => setSelectedId(null)}
            onChanged={() => mutate()}
          />

          {showPrompt && (
            <div className="glass haven-rise pointer-events-auto rounded-card p-4">
              <div className="flex items-start gap-3">
                <Navigation
                  className="mt-0.5 size-5 shrink-0 text-brand"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold tracking-[-0.01em]">
                    See what&apos;s near you
                  </p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
                    {status === "denied"
                      ? "Location is blocked in your browser settings. You can still search a place."
                      : "Your location stays on your device and is only used to show distances."}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {status === "prompt" && (
                  <button
                    onClick={request}
                    className="press h-11 flex-1 rounded-full bg-text text-[14.5px] font-semibold text-bg"
                  >
                    Use my location
                  </button>
                )}
                <button
                  onClick={() => setPromptDismissed(true)}
                  className="press h-11 flex-1 rounded-full bg-white/[0.08] px-4 text-[14.5px] font-medium text-text"
                >
                  Not now
                </button>
              </div>
            </div>
          )}
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
      <LayersSheet
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        value={mode}
        onChange={chooseMode}
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
