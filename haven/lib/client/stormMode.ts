// Storm Mode on/off and its language (English / Spanish), remembered on this
// device. Read with useSyncExternalStore so every screen agrees instantly.

import { useSyncExternalStore } from "react";
import type { Lang } from "@/lib/storm";

const KEY = "haven.storm.v1";

interface StormPrefs {
  on: boolean;
  lang: Lang;
}

let cached: StormPrefs | null = null;
const listeners = new Set<() => void>();

function defaults(): StormPrefs {
  const es = typeof navigator !== "undefined" && /^es\b/i.test(navigator.language || "");
  return { on: false, lang: es ? "es" : "en" };
}

function read(): StormPrefs {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<StormPrefs>) : {};
    const d = defaults();
    cached = { on: v.on === true, lang: v.lang === "es" || v.lang === "en" ? v.lang : d.lang };
  } catch {
    cached = defaults();
  }
  return cached;
}

const SERVER: StormPrefs = { on: false, lang: "en" };

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStormPrefs(): StormPrefs {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}

export function setStormPrefs(patch: Partial<StormPrefs>) {
  cached = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Storage blocked: lasts for this visit.
  }
  listeners.forEach((l) => l());
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
