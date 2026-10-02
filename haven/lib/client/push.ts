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

// A test notification that was seen arriving on this device, remembered with
// the subscription it arrived on. "Push ready" is only ever claimed from this.
const VERIFIED_KEY = "haven.push.verified.v1";
interface Verified {
  at: number;
  endpoint: string;
}
let verifiedCache: Verified | null | undefined;
const verifiedListeners = new Set<() => void>();
function readVerified(): Verified | null {
  if (verifiedCache !== undefined) return verifiedCache;
  try {
    const v = JSON.parse(localStorage.getItem(VERIFIED_KEY) ?? "null") as Verified | null;
    verifiedCache = v && typeof v.at === "number" && typeof v.endpoint === "string" ? v : null;
  } catch {
    verifiedCache = null;
  }
  return verifiedCache;
}
function writeVerified(v: Verified | null) {
  verifiedCache = v;
  try {
    if (v) localStorage.setItem(VERIFIED_KEY, JSON.stringify(v));
    else localStorage.removeItem(VERIFIED_KEY);
  } catch {
    // Storage blocked: the confirmation lasts for this visit.
  }
  verifiedListeners.forEach((l) => l());
}
function useVerified(): Verified | null {
  return useSyncExternalStore(
    (cb) => {
      verifiedListeners.add(cb);
      return () => verifiedListeners.delete(cb);
    },
    readVerified,
    () => null,
  );
}

/** How long to wait for a test notification to show up on this device. */
export const TEST_WAIT_MS = 15_000;
export type TestResult = "received" | "sent_not_seen" | "not_sent";

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
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const verified = useVerified();
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
        if (!cancelled) {
          setLocal(sub ? "subscribed" : "not");
          setEndpoint(sub?.endpoint ?? null);
        }
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
      setEndpoint(sub.endpoint);
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
      setEndpoint(null);
      writeVerified(null);
      await mutate();
    } finally {
      setBusy(false);
    }
  }, [mutate]);

  /**
   * Sends a test and waits to see it arrive here. "Sent" by the server is not
   * the same as delivered: only a notification the service worker actually
   * received on this device counts.
   */
  const sendTest = useCallback(async (): Promise<TestResult> => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    // An older worker can't report arrivals; pick up the current one first.
    await reg?.update().catch(() => {});
    const sub = await reg?.pushManager.getSubscription();
    let stop = () => {};
    const arrived = new Promise<boolean>((resolve) => {
      const onMessage = (e: MessageEvent) => {
        const d = e.data as { type?: string; tag?: string } | null;
        if (d?.type === "haven-push" && d.tag === "haven-test") resolve(true);
      };
      navigator.serviceWorker.addEventListener("message", onMessage);
      const timer = setTimeout(() => resolve(false), TEST_WAIT_MS);
      stop = () => {
        navigator.serviceWorker.removeEventListener("message", onMessage);
        clearTimeout(timer);
      };
    });
    try {
      const r = await apiSend<{ sent: number }>("/api/push/test", "POST");
      if (r.sent === 0) return "not_sent";
      if (!(await arrived)) return "sent_not_seen";
      if (sub) writeVerified({ at: Date.now(), endpoint: sub.endpoint });
      return "received";
    } finally {
      stop();
    }
  }, []);

  /** The person says the test notification did appear (when the page couldn't see it arrive). */
  const confirmSeen = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) writeVerified({ at: Date.now(), endpoint: sub.endpoint });
  }, []);

  // A confirmation only stands for the subscription it was made on.
  const verifiedAt = status === "on" && verified && endpoint && verified.endpoint === endpoint ? verified.at : null;

  return { status, busy, error, devices: data?.devices ?? 0, enable, disable, sendTest, confirmSeen, verifiedAt, standalone, ios: isIOS() };
}

/** Keeps the home-screen badge in step with unread alerts. */
export function useAppBadge(unread: number) {
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    (unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge?.())?.catch(() => {});
  }, [unread]);
}
