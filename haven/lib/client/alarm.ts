// Safe Walk alarm. A looping tone played through an <audio> element, which
// keeps working after navigating around the app and (with audioSession set)
// isn't muted by the iPhone silent switch. Browsers only allow sound that a
// tap started, so `primeAlarm()` must run inside the "Start" tap.
//
// Vibration works on Android. iPhone browsers don't allow websites to vibrate.

import { useSyncExternalStore } from "react";

let el: HTMLAudioElement | null = null;
let blocked = false;
const blockedListeners = new Set<() => void>();

function setBlocked(v: boolean) {
  if (blocked === v) return;
  blocked = v;
  blockedListeners.forEach((l) => l());
}

function subscribeBlocked(cb: () => void) {
  blockedListeners.add(cb);
  return () => blockedListeners.delete(cb);
}

/** True when the browser refused to play the siren (e.g. after a reload, before any tap). */
export function useAlarmBlocked(): boolean {
  return useSyncExternalStore(subscribeBlocked, () => blocked, () => false);
}

let buzz: ReturnType<typeof setInterval> | null = null;
let primed = false;

/** A short two-tone siren as a WAV file, built in memory. */
function sirenUrl(): string {
  const rate = 22050;
  const seconds = 1.2;
  const n = Math.floor(rate * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const freq = t % 0.6 < 0.3 ? 960 : 720;
    phase += (2 * Math.PI * freq) / rate;
    // Short fades at each tone change avoid clicks.
    const edge = Math.min(1, ((t % 0.3) / 0.01), ((0.3 - (t % 0.3)) / 0.01));
    v.setInt16(44 + i * 2, Math.sin(phase) * 0.8 * edge * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

function element(): HTMLAudioElement {
  if (!el) {
    el = new Audio(sirenUrl());
    el.loop = true;
    el.preload = "auto";
  }
  return el;
}

/** Call from a tap. Unlocks sound for later and asks iPhone to ignore the silent switch. */
export function primeAlarm() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch {
    // Older browsers: the silent switch may mute the alarm.
  }
  try {
    const a = element();
    a.muted = true;
    void a
      .play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        primed = true;
      })
      .catch(() => {
        a.muted = false;
      });
  } catch {
    // No audio support.
  }
}

/** Starts the siren and vibration. Resolves false if the browser blocked the sound. */
export async function startAlarm(): Promise<boolean> {
  if (!buzz && "vibrate" in navigator) {
    navigator.vibrate([500, 200, 500, 200, 500]);
    buzz = setInterval(() => navigator.vibrate([500, 200, 500, 200, 500]), 3000);
  }
  try {
    const a = element();
    a.muted = false;
    a.volume = 1;
    await a.play();
    setBlocked(false);
    return true;
  } catch {
    setBlocked(true);
    return false;
  }
}

export function stopAlarm() {
  setBlocked(false);
  if (buzz) {
    clearInterval(buzz);
    buzz = null;
  }
  if ("vibrate" in navigator) navigator.vibrate(0);
  if (el) {
    el.pause();
    el.currentTime = 0;
  }
}

export function alarmPrimed() {
  return primed;
}

/** iPhone and iPad browsers can't vibrate. Used to set expectations in the UI. */
export function canVibrate() {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}
