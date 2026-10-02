"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { apiSend, fetcher } from "./api";
import { useViewer } from "./hooks";

/**
 * Where this device stands with push notifications:
 * - unsupported: no Push API (old browser, or iPhone Safari without install)
 * - install:     iPhone in the browser; push only works from the home screen
 * - setup:       the server has no VAPID keys yet
 * - denied:      the person said no in the browser prompt
 * - off / on:    supported and ready; subscribed or not on this device
 */
export type PushStatus = "unsupported" | "install" | "setup" | "denied" | "off" | "on" | "loading";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** True when running from the home screen (installed PWA). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useStandalone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    isStandalone,
    () => false,
  );
}

function supportsPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export function usePush() {
  const { viewer } = useViewer();
  const { data, mutate } = useSWR<{ enabled: boolean; publicKey: string | null; devices: number }>(
    viewer ? "/api/push/subscribe" : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const standalone = useStandalone();
  const [local, setLocal] = useState<"unknown" | "subscribed" | "not">("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Is this device already subscribed? (Checked once; it doesn't change under us.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supportsPush()) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setLocal(sub ? "subscribed" : "not");
      } catch {
        if (!cancelled) setLocal("not");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  let status: PushStatus = "loading";
  if (!supportsPush()) status = isIOS() && !standalone ? "install" : "unsupported";
  else if (data && !data.enabled) status = "setup";
  else if (typeof Notification !== "undefined" && Notification.permission === "denied") status = "denied";
  else if (data && local !== "unknown") status = local === "subscribed" ? "on" : "off";

  const publicKey = data?.publicKey ?? null;
  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      // Must happen inside the tap handler, or Safari ignores it.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setLocal("not");
        return;
      }
      const reg = await registration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey }));
      const json = sub.toJSON();
      await apiSend("/api/push/subscribe", "POST", { endpoint: sub.endpoint, keys: json.keys });
      setLocal("subscribed");
      await mutate();
    } catch (err) {
      setError((err as Error).message || "Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  }, [publicKey, mutate]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiSend("/api/push/subscribe", "DELETE", { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setLocal("not");
      await mutate();
    } finally {
      setBusy(false);
    }
  }, [mutate]);

  const sendTest = useCallback(async () => {
    const r = await apiSend<{ sent: number }>("/api/push/test", "POST");
    return r.sent;
  }, []);

  return { status, busy, error, devices: data?.devices ?? 0, enable, disable, sendTest, standalone, ios: isIOS() };
}

/** Keeps the home-screen badge in step with unread alerts. */
export function useAppBadge(unread: number) {
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    (unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge?.())?.catch(() => {});
  }, [unread]);
}
