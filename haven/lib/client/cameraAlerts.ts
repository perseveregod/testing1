"use client";

// The plate-reader watch: runs while "Alert me near plate readers" is on and
// Haven is open. Keeps the current heads-up in a tiny store so the banner can
// live above every tab, and handles the buzz and chime.

import { useSyncExternalStore } from "react";
import type { CameraHit } from "@/lib/cameraWatch";

export interface CameraAlert extends CameraHit {
  at: number;
}

let current: CameraAlert | null = null;
const listeners = new Set<() => void>();

export function useCameraAlert(): CameraAlert | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

export function setCameraAlert(next: CameraAlert | null) {
  current = next;
  listeners.forEach((l) => l());
}

// ---- feedback ---------------------------------------------------------------

let ctx: AudioContext | null = null;

/** Call from the tap that turns alerts on; browsers only unlock sound inside a gesture. */
export function primeChime() {
  try {
    const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // No audio; the banner and buzz still work.
  }
}

/** Two short rising notes, like a radar detector but quieter. */
export function chime() {
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  for (const [i, f] of [880, 1318].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.14);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.14 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.14 + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + i * 0.14);
    osc.stop(t0 + i * 0.14 + 0.14);
  }
}

export function buzz() {
  try {
    navigator.vibrate?.([70, 50, 70]);
  } catch {
    // iPhone browsers can't vibrate.
  }
}
