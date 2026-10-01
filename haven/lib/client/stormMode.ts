// Storm Mode on/off, remembered on this device. Its language is the app's
// language (lib/client/lang.ts); `lang` is kept on the returned object so the
// storm screens read one value. Read with useSyncExternalStore so every screen
// agrees instantly.

import { useSyncExternalStore } from "react";
import type { Lang } from "@/lib/storm";
import { setLang, useLang } from "./lang";

const KEY = "haven.storm.v1";

interface StormPrefs {
  on: boolean;
  lang: Lang;
}

let cached: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (cached != null) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as { on?: unknown }) : {};
    cached = v.on === true;
  } catch {
    cached = false;
  }
  return cached;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStormPrefs(): StormPrefs {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const lang = useLang();
  return { on, lang };
}

export function setStormPrefs(patch: Partial<StormPrefs>) {
  if (patch.lang) setLang(patch.lang);
  if (patch.on != null) {
    cached = patch.on;
    try {
      localStorage.setItem(KEY, JSON.stringify({ on: cached }));
    } catch {
      // Storage blocked: lasts for this visit.
    }
    listeners.forEach((l) => l());
  }
}

/**
 * Shrinks a photo in the browser and re-encodes it as JPEG. Re-encoding drops
 * EXIF data, including the GPS location phones embed in photos.
 */
export async function preparePhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file isn't a photo we can read."));
      i.src = url;
    });
    const max = 1024;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.72, 0.6, 0.48, 0.36]) {
      const out = canvas.toDataURL("image/jpeg", q);
      if (out.length < 280_000) return out;
    }
    throw new Error("That photo is too large. Try another one.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// "Report" in Storm Mode lives on the tab bar's center button, which is
// outside the map screen. A tick lets the button ask the map to open the
// report sheet without routing or shared React state.
let reportTick = 0;
const reportListeners = new Set<() => void>();

export function requestStormReport() {
  reportTick += 1;
  reportListeners.forEach((l) => l());
}

export function useStormReportTick(): number {
  return useSyncExternalStore(
    (cb) => {
      reportListeners.add(cb);
      return () => reportListeners.delete(cb);
    },
    () => reportTick,
    () => 0,
  );
}
