"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SWRConfig } from "swr";
import { apiSend, fetcher } from "@/lib/client/api";
import { useAlertPrefs, useNotifications } from "@/lib/client/hooks";
import { LocationProvider, useLocation } from "./LocationProvider";
import { ToastProvider } from "./ToastProvider";
import { SafeWalkWatcher } from "@/components/safety/SafeWalkWatcher";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, shouldRetryOnError: false, dedupingInterval: 4000 }}>
      <ToastProvider>
        <LocationProvider>
          {children}
          <NearMeSync />
          <NotificationWatcher />
          <SafeWalkWatcher />
        </LocationProvider>
      </ToastProvider>
    </SWRConfig>
  );
}

/** Shares an approximate location with the server only while near-me alerts are on. */
function NearMeSync() {
  const { position } = useLocation();
  const { prefs } = useAlertPrefs();
  const lastSent = useRef<{ at: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!prefs?.enabled || !prefs.nearMe || !position) return;
    const prev = lastSent.current;
    const moved = !prev || Math.abs(prev.lat - position.lat) > 0.005 || Math.abs(prev.lng - position.lng) > 0.005;
    if (!moved && prev && Date.now() - prev.at < 10 * 60_000) return;
    lastSent.current = { at: Date.now(), lat: position.lat, lng: position.lng };
    apiSend("/api/me/location", "POST", { latitude: position.lat, longitude: position.lng }).catch(() => {
      lastSent.current = null;
    });
  }, [position, prefs?.enabled, prefs?.nearMe]);
  return null;
}

/** Surfaces new alerts as system notifications while the app is in the background. */
function NotificationWatcher() {
  const { items, loaded } = useNotifications();
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!loaded) return;
    // The first loaded list is the baseline; only later arrivals notify.
    if (!seen.current) {
      seen.current = new Set(items.map((n) => n.id));
      return;
    }
    const fresh = items.filter((n) => !seen.current!.has(n.id) && !n.readAt);
    fresh.forEach((n) => seen.current!.add(n.id));
    if (
      fresh.length &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      document.visibilityState === "hidden"
    ) {
      for (const n of fresh.slice(0, 3)) {
        const note = new Notification(n.title, { body: n.body, tag: n.incidentId, icon: "/icon.svg" });
        note.onclick = () => {
          window.focus();
          router.push(`/incidents/${n.incidentId}`);
        };
      }
    }
  }, [items, loaded, router]);
  return null;
}
