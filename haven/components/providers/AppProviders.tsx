"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SWRConfig } from "swr";
import { apiSend, fetcher } from "@/lib/client/api";
import { approximate } from "@/lib/geo";
import { useAlertPrefs, useNotifications } from "@/lib/client/hooks";
import { LangSync } from "@/lib/client/lang";
import { CameraAlertWatcher } from "@/components/cameras/CameraAlertWatcher";
import { CameraAlertBanner } from "@/components/cameras/CameraAlertBanner";
import { LocationProvider, useLocation } from "./LocationProvider";
import { ToastProvider } from "./ToastProvider";
import { SafeWalkWatcher } from "@/components/safety/SafeWalkWatcher";
import { EmailLinkHandler } from "./EmailLinkHandler";
import { OfflineNotice } from "@/components/OfflineNotice";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, shouldRetryOnError: false, dedupingInterval: 4000 }}>
      <ToastProvider>
        <LocationProvider>
          {children}
          <NearMeSync />
          <NotificationWatcher />
          <SafeWalkWatcher />
          <EmailLinkHandler />
          <OfflineNotice />
          <LangSync />
          <CameraAlertWatcher />
          <CameraAlertBanner />
        </LocationProvider>
      </ToastProvider>
    </SWRConfig>
  );
}

/**
 * While near-me alerts are on, sends one rounded point (within about half a
 * mile) so the server can match alerts. The exact fix never leaves the phone.
 * If the browser's location permission is taken away, the stored point goes too.
 */
function NearMeSync() {
  const { position, status } = useLocation();
  const { prefs } = useAlertPrefs();
  const lastSent = useRef<{ at: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!prefs?.enabled || !prefs.nearMe || !position) return;
    const prev = lastSent.current;
    const moved = !prev || Math.abs(prev.lat - position.lat) > 0.005 || Math.abs(prev.lng - position.lng) > 0.005;
    if (!moved && prev && Date.now() - prev.at < 10 * 60_000) return;
    lastSent.current = { at: Date.now(), lat: position.lat, lng: position.lng };
    const rough = approximate(position, 2);
    apiSend("/api/me/location", "POST", { latitude: rough.lat, longitude: rough.lng }).catch(() => {
      lastSent.current = null;
    });
  }, [position, prefs?.enabled, prefs?.nearMe]);

  // Location blocked while near-me is still switched on: don't keep matching
  // alerts against wherever this person last was.
  const blocked = status === "denied" && Boolean(prefs?.enabled && prefs.nearMe);
  useEffect(() => {
    if (!blocked) return;
    lastSent.current = null;
    apiSend("/api/me/location", "DELETE").catch(() => {});
  }, [blocked]);
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
