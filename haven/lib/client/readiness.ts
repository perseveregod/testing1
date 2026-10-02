"use client";

// The one place the app decides whether alerts can really reach this person
// on this device. Screens show this, never the raw switches.

import { alertReadiness, type ReadinessResult } from "@/lib/alertReadiness";
import { useLocation } from "@/components/providers/LocationProvider";
import { useAlertPrefs, usePlaces } from "./hooks";
import { usePush } from "./push";

export function useAlertReadiness(): ReadinessResult & { push: ReturnType<typeof usePush>; loaded: boolean } {
  const { prefs } = useAlertPrefs();
  const { places, isLoading: placesLoading } = usePlaces();
  const { status } = useLocation();
  const push = usePush();
  const r = alertReadiness({
    prefs,
    places,
    locationGranted: status === "granted",
    push: push.status,
    verifiedAt: push.verifiedAt,
  });
  return { ...r, push, loaded: Boolean(prefs) && !placesLoading && push.status !== "loading" };
}
