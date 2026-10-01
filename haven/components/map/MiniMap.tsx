"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import { MapPin } from "lucide-react";
import { MAP_STYLE_URL } from "@/lib/client/defaults";
import type { LatLng } from "@/lib/geo";
import { tuneStyle } from "./IncidentMap";
import { FALLBACK_RASTER_STYLE, isStyleError } from "./mapStyle";

/**
 * Small map. In "preview" mode it's static with a marker at `center`.
 * In "picker" mode the pin stays centered and the map moves under it;
 * `onChange` reports the point under the pin.
 */
export function MiniMap({
  center,
  mode,
  color = "#5ee0c8",
  onChange,
  recenterKey,
  className = "",
  label,
  attribution = true,
}: {
  center: LatLng;
  mode: "preview" | "picker";
  color?: string;
  onChange?: (p: LatLng) => void;
  /** Change this to fly the picker to a new `center`. */
  recenterKey?: string | number;
  className?: string;
  label: string;
  /** Hide the on-map attribution control (credit the map elsewhere on the page). */
  attribution?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const onChangeRef = useRef(onChange);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      const m = new ml.Map({
        container: container.current,
        style: MAP_STYLE_URL,
        center: [center.lng, center.lat],
        zoom: mode === "picker" ? 16 : 14.5,
        interactive: mode === "picker",
        attributionControl: attribution ? { compact: true } : false,
        dragRotate: false,
        touchPitch: false,
      });
      if (mode === "picker") m.touchZoomRotate.disableRotation();
      map.current = m;
      let fellBack = false;
      m.on("error", (e) => {
        if (!fellBack && isStyleError(e.error)) {
          fellBack = true;
          m.setStyle(FALLBACK_RASTER_STYLE);
        }
      });
      m.on("style.load", () => tuneStyle(m));
      m.on("load", () => {
        setLoaded(true);
        const c = m.getCenter();
        onChangeRef.current?.({ lat: c.lat, lng: c.lng });
      });
      m.on("moveend", () => {
        const c = m.getCenter();
        onChangeRef.current?.({ lat: c.lat, lng: c.lng });
      });
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // Map is created once; recentering goes through recenterKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recenterKey === undefined) return;
    map.current?.flyTo({ center: [center.lng, center.lat], zoom: 16, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  return (
    <div className={`relative overflow-hidden rounded-[20px] bg-surface-2 ${className}`}>
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" role="img" aria-label={label} />
      </div>
      {!loaded && <div className="haven-shimmer absolute inset-0" aria-hidden />}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        {mode === "picker" ? (
          <div className="flex -translate-y-5 flex-col items-center">
            <MapPin className="size-10 drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" style={{ color }} fill="#0b0c0f" strokeWidth={2.2} />
            <span className="mt-1 size-1.5 rounded-full bg-black/60 blur-[1px]" />
          </div>
        ) : (
          <div className="relative size-6">
            <span className="haven-pulse absolute inset-0 rounded-full" style={{ background: `${color}66` }} />
            <span className="absolute inset-1 rounded-full border-2 border-white" style={{ background: color }} />
          </div>
        )}
      </div>
      {mode === "picker" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-bg/75 px-3 py-1.5 text-[12px] font-medium text-muted backdrop-blur-md">
            Drag the map to place the pin
          </span>
        </div>
      )}
    </div>
  );
}
