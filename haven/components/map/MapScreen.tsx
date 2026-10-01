"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Navigation, Search, SlidersHorizontal } from "lucide-react";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { distanceFrom, useIncidents, useViewer } from "@/lib/client/hooks";
import type { LatLng } from "@/lib/geo";
import { useLocation } from "@/components/providers/LocationProvider";
import { IncidentPreview } from "@/components/incident/IncidentPreview";
import { IconButton } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/States";
import { activeFilterCount, DEFAULT_FILTERS, FilterSheet, filterParams, type MapFilters } from "./FilterSheet";
import { IncidentMap, type MapHandle, type Viewport } from "./IncidentMap";
import { SearchSheet } from "./SearchSheet";

const RADIUS_BUCKETS = [1, 2, 5, 10, 25, 50];

/** Snap the viewport so small pans reuse the same query (and SWR cache). */
function queryArea(v: Viewport | null): { center: LatLng; radiusMi: number } | null {
  if (!v) return null;
  const radiusMi = RADIUS_BUCKETS.find((b) => b >= v.radiusMi * 1.15) ?? 50;
  const step = radiusMi <= 2 ? 0.005 : radiusMi <= 10 ? 0.02 : 0.1;
  return {
    center: { lat: Math.round(v.center.lat / step) * step, lng: Math.round(v.center.lng / step) * step },
    radiusMi,
  };
}

export function MapScreen() {
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
  const flewToUser = useRef(false);

  const area = useMemo(() => queryArea(viewport), [viewport]);
  const { items, isLoading, isValidating, error, mutate } = useIncidents({
    center: area?.center ?? null,
    radiusMi: area?.radiusMi ?? 5,
    ...filterParams(filters, viewer),
  });

  // Jump to the person's location the first time we learn it.
  useEffect(() => {
    if (position && !flewToUser.current) {
      flewToUser.current = true;
      mapRef.current?.flyTo(position, 14);
    }
  }, [position]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const filterCount = activeFilterCount(filters);
  const demoCount = items.filter((i) => i.isDemo).length;
  const activeCount = items.filter((i) => i.status !== "resolved").length;

  const locate = useCallback(() => {
    if (position) mapRef.current?.flyTo(position, 15);
    else request();
  }, [position, request]);

  const showPrompt =
    !selected && !position && !promptDismissed && (status === "prompt" || status === "denied" || status === "unavailable");

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
      />
      {/* Atmosphere: vignette and grain over the map, gradients under the controls. */}
      <div className="vignette pointer-events-none absolute inset-0" aria-hidden />
      <div className="grain pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-bg/90 via-bg/40 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg/90 via-bg/40 to-transparent" aria-hidden />

      {/* Top: search + filters */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20" style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}>
        <div className="pointer-events-auto mx-auto flex max-w-lg gap-2 px-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="glass press flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 text-left"
          >
            <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
            <span className={`truncate text-[15.5px] ${searchLabel ? "text-text" : "text-muted"}`}>{searchLabel ?? "Search a place"}</span>
          </button>
          <IconButton label={`Filters${filterCount ? ` (${filterCount} active)` : ""}`} onClick={() => setFilterOpen(true)} className="relative">
            <SlidersHorizontal className="size-[18px]" aria-hidden />
            {filterCount > 0 && (
              <span className="haven-pop absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-text text-[10px] font-bold text-bg tnum ring-2 ring-bg">
                {filterCount}
              </span>
            )}
          </IconButton>
        </div>
        <div className="mx-auto mt-2.5 flex max-w-lg justify-center px-4">
          <div className="pointer-events-auto inline-flex h-7 items-center gap-2 rounded-full bg-bg/70 px-3 text-[12.5px] font-medium text-muted backdrop-blur-md tnum">
            {isLoading || (isValidating && !items.length) ? (
              <>
                <Spinner className="size-3" /> Loading
              </>
            ) : error ? (
              <button onClick={() => mutate()} className="text-danger">
                Couldn&apos;t load · Retry
              </button>
            ) : (
              <>
                <span className={`size-1.5 rounded-full ${activeCount ? "bg-danger" : "bg-ok"}`} aria-hidden />
                <span>
                  {activeCount} active in view
                  {demoCount > 0 && <span className="text-faint"> · demo</span>}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: locate button + preview / location prompt */}
      <div className="pointer-events-none absolute inset-x-0 z-20 bottom-nav-offset">
        <div className="mx-auto flex max-w-lg flex-col items-end gap-3 px-4 pb-3">
          <IconButton label={position ? "Center on my location" : "Use my location"} onClick={locate} className="pointer-events-auto">
            {status === "locating" ? (
              <Spinner className="size-[18px]" />
            ) : (
              <LocateFixed className={`size-[18px] ${position ? "text-brand" : ""}`} aria-hidden />
            )}
          </IconButton>

          <IncidentPreview
            incident={selected}
            distanceMi={selected ? distanceFrom(position, selected) : null}
            onClose={() => setSelectedId(null)}
            onChanged={() => mutate()}
          />

          {showPrompt && (
            <div className="glass haven-rise pointer-events-auto w-full rounded-[22px] p-4">
              <div className="flex items-start gap-3">
                <Navigation className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold tracking-[-0.01em]">See what&apos;s near you</p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
                    {status === "denied"
                      ? "Location is blocked in your browser settings. You can still search a place."
                      : "Your location stays on your device and is only used to show distances."}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {status === "prompt" && (
                  <button onClick={request} className="press h-11 flex-1 rounded-full bg-text text-[14.5px] font-semibold text-bg">
                    Use my location
                  </button>
                )}
                <button onClick={() => setPromptDismissed(true)} className="press h-11 rounded-full bg-white/[0.06] px-5 text-[14.5px] font-medium text-muted">
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
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onChange={setFilters} viewer={viewer} />
    </div>
  );
}
