"use client";

import { useCallback } from "react";
import { distanceMiles } from "@/lib/geo";
import { useAlertPrefs, usePlaces } from "./hooks";

export interface Affects {
  /** The saved place's label, e.g. "Home". */
  label: string;
  distanceMi: number;
}

/**
 * "Does this affect me?": the nearest saved place an incident falls within
 * (the place's own radius, else the account's alert radius). Computed on the
 * client from places the person already has; nothing leaves the device.
 */
export function useAffects() {
  const { places } = usePlaces();
  const { prefs } = useAlertPrefs();
  const fallbackMi = prefs?.radiusMi ?? 3;
  return useCallback(
    (i: { latitude: number; longitude: number }): Affects | null => {
      let best: Affects | null = null;
      for (const p of places) {
        const d = distanceMiles({ lat: p.latitude, lng: p.longitude }, { lat: i.latitude, lng: i.longitude });
        if (d > (p.radiusMi ?? fallbackMi)) continue;
        if (!best || d < best.distanceMi) best = { label: p.label, distanceMi: d };
      }
      return best;
    },
    [places, fallbackMi],
  );
}
