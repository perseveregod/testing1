"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { approximate, distanceMiles, type LatLng } from "@/lib/geo";

// One shared geolocation watcher for the whole app. Location never leaves the
// device except as (a) query params for nearby incidents and (b) a ~1 km
// rounded point when the person turns on "alerts near me".
//
// The last fix, rounded to ~100 m, is kept on the device so the next open can
// start on the right part of town before the GPS answers.

const LAST_KEY = "haven.lastpos.v1";
let lastStored: LatLng | null | undefined;
const lastListeners = new Set<() => void>();

function readLast(): LatLng | null {
  if (lastStored !== undefined) return lastStored;
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as LatLng | null;
    lastStored = v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null;
  } catch {
    lastStored = null;
  }
  return lastStored;
}

function rememberLast(p: LatLng) {
  const rounded = approximate(p, 3);
  const prev = readLast();
  // Only a real move is worth a write; a watch ticks every few seconds.
  if (prev && distanceMiles(prev, rounded) < 0.1) return;
  lastStored = rounded;
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(rounded));
  } catch {
    // Storage blocked: the next open starts downtown, as before.
  }
  lastListeners.forEach((l) => l());
}

/**
 * Pick an area by hand (a neighborhood or an address) instead of using GPS.
 * It takes the place of "where this person last was" on this device, so every
 * screen shows that part of town. A live GPS fix, when there is one, wins.
 */
export function chooseArea(p: LatLng) {
  const rounded = approximate(p, 3);
  lastStored = rounded;
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(rounded));
  } catch {
    // Storage blocked: the choice lasts for this visit.
  }
  lastListeners.forEach((l) => l());
}

/** The remembered position, read directly (for code that runs once, outside render). */
export function lastKnownPosition(): LatLng | null {
  return typeof window === "undefined" ? null : readLast();
}

function useLastStored(): LatLng | null {
  return useSyncExternalStore(
    (cb) => {
      lastListeners.add(cb);
      return () => lastListeners.delete(cb);
    },
    readLast,
    () => null,
  );
}

export type LocationStatus = "idle" | "prompt" | "locating" | "granted" | "denied" | "unavailable";

interface LocationState {
  /** A live fix, or null until the browser gives one. */
  position: LatLng | null;
  /** The live fix, or where the person last was (~100 m) until it arrives. Null on a first visit. */
  lastPosition: LatLng | null;
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
  const stored = useLastStored();
  const lastPosition = position ?? stored;

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
        rememberLast({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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
    () => ({ position, lastPosition, accuracyM, heading, status, request: start, setPrecise }),
    [position, lastPosition, accuracyM, heading, status, start, setPrecise],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation(): LocationState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocation must be used inside LocationProvider");
  return v;
}
