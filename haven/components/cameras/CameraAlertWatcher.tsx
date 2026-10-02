"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { useLayerPrefs } from "@/lib/client/layers";
import { buzz, chime, setCameraAlert } from "@/lib/client/cameraAlerts";
import { pickCameraAlert, type WatchedCamera } from "@/lib/cameraWatch";
import { useLocation } from "@/components/providers/LocationProvider";

interface Snapshot {
  cameras: WatchedCamera[];
}

/**
 * Watches your position against the plate-reader map while alerts are on.
 * Mounted once, app-wide. Nothing leaves the device: the camera list is a
 * public snapshot and the comparison happens here.
 */
export function CameraAlertWatcher() {
  const { cameraAlerts } = useLayerPrefs();
  const { position, heading, status, request, setPrecise } = useLocation();
  const { data } = useSWR<Snapshot>(cameraAlerts ? "/layers/alpr-houston" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3_600_000,
  });
  const alerted = useRef(new Map<string, number>());
  const shownId = useRef<string | null>(null);

  // Precise GPS only while the watch is on.
  useEffect(() => {
    if (!cameraAlerts) return;
    setPrecise(true);
    if (status === "prompt" || status === "idle") request();
    return () => setPrecise(false);
  }, [cameraAlerts, setPrecise, request, status]);

  useEffect(() => {
    if (!cameraAlerts) {
      shownId.current = null;
      setCameraAlert(null);
      return;
    }
    if (!position || !data) return;
    const now = Date.now();
    const hit = pickCameraAlert(position, heading, data.cameras, alerted.current, now);
    if (hit) {
      alerted.current.set(hit.camera.id, now);
      shownId.current = hit.camera.id;
      setCameraAlert({ ...hit, at: now });
      buzz();
      chime();
      return;
    }
    // Past it: let the banner go once you're clear or it's gone stale.
    if (shownId.current) {
      const cam = data.cameras.find((c) => c.id === shownId.current);
      const stillNear =
        cam && Math.abs(cam.lat - position.lat) < 0.004 && Math.abs(cam.lng - position.lng) < 0.004;
      if (!stillNear) {
        shownId.current = null;
        setCameraAlert(null);
      }
    }
  }, [cameraAlerts, position, heading, data]);

  // Banners don't outlive their moment.
  useEffect(() => {
    if (!cameraAlerts) return;
    const t = setInterval(() => {
      if (shownId.current && alerted.current.get(shownId.current)! < Date.now() - 45_000) {
        shownId.current = null;
        setCameraAlert(null);
      }
    }, 5_000);
    return () => clearInterval(t);
  }, [cameraAlerts]);

  return null;
}
