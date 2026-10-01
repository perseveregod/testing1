"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

// One shared geolocation watcher for the whole app. Location never leaves the
// device except as (a) query params for nearby incidents and (b) a ~1 km
// rounded point when the person turns on "alerts near me".

export type LocationStatus = "idle" | "prompt" | "locating" | "granted" | "denied" | "unavailable";

interface LocationState {
  position: LatLng | null;
  accuracyM: number | null;
  /** Degrees clockwise from north while moving; null when unknown or still. */
  heading: number | null;
  status: LocationStatus;
  request: () => void;
  /** Precise, frequent fixes (GPS) while something needs them, e.g. the camera watch. */
  setPrecise: (on: boolean) => void;
}

const Ctx = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [accuracyM, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const watchId = useRef<number | null>(null);
  const precise = useRef(false);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    if (watchId.current != null) return;
    setStatus((s) => (s === "granted" ? s : "locating"));
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy);
        const h = pos.coords.heading;
        // Browsers report NaN or null when still; only a moving fix has a heading.
        setHeading(h != null && Number.isFinite(h) && (pos.coords.speed ?? 0) > 1 ? h : null);
        setStatus("granted");
      },
      (err) => {
        if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      precise.current
        ? { enableHighAccuracy: true, maximumAge: 2_000, timeout: 20_000 }
        : { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    );
  }, []);

  const setPrecise = useCallback(
    (on: boolean) => {
      if (precise.current === on) return;
      precise.current = on;
      // Restart the watch with the new accuracy, only if one is running.
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        start();
      }
    },
    [start],
  );

  // Start automatically only if permission was already granted; otherwise
  // wait for a tap so the browser prompt has context.
  useEffect(() => {
    let cancelled = false;
    const perms = typeof navigator !== "undefined" ? navigator.permissions : undefined;
    if (!perms?.query) {
      queueMicrotask(() => !cancelled && setStatus("prompt"));
      return;
    }
    perms
      .query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (cancelled) return;
        if (p.state === "granted") start();
        else setStatus(p.state === "denied" ? "denied" : "prompt");
      })
      .catch(() => !cancelled && setStatus("prompt"));
    return () => {
      cancelled = true;
    };
  }, [start]);

  useEffect(
    () => () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  const value = useMemo(
    () => ({ position, accuracyM, heading, status, request: start, setPrecise }),
    [position, accuracyM, heading, status, start, setPrecise],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation(): LocationState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocation must be used inside LocationProvider");
  return v;
}
