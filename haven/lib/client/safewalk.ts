// Safe Walk: a check-in timer for walking somewhere alone. Everything stays on
// this device (localStorage). Haven never sends texts by itself; it prepares
// a message the person sends from their own phone with one tap.

import { useCallback, useSyncExternalStore } from "react";
import type { LatLng } from "@/lib/geo";

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
}

export interface ActiveWalk {
  startedAt: number;
  endsAt: number;
  destination: string;
}

export interface SafeWalkState {
  contacts: TrustedContact[];
  walk: ActiveWalk | null;
}

/** How long after a missed check-in before we push the person to alert contacts. */
export const GRACE_MS = 60_000;
export const DURATIONS_MIN = [10, 15, 30, 45, 60] as const;
export const MAX_CONTACTS = 5;

const KEY = "haven.safewalk.v1";

export function loadSafeWalk(): SafeWalkState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { contacts: [], walk: null };
    const v = JSON.parse(raw) as Partial<SafeWalkState>;
    return {
      contacts: Array.isArray(v.contacts) ? v.contacts.filter((c) => c && c.name && c.phone).slice(0, MAX_CONTACTS) : [],
      walk: v.walk && typeof v.walk.endsAt === "number" ? v.walk : null,
    };
  } catch {
    return { contacts: [], walk: null };
  }
}

export function saveSafeWalk(state: SafeWalkState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode or storage blocked: the walk still works for this visit.
  }
}

/** Keeps a leading + and digits. Returns null if it can't be a phone number. */
export function cleanPhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return (trimmed.startsWith("+") ? "+" : "") + digits;
}

/** "12:05" style countdown. Negative values read as 0:00. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function mapsLink(p: LatLng): string {
  return `https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

/** An sms: link that opens the phone's messaging app with the text filled in. */
export function smsHref(phone: string, body: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(body)}`;
}

export function startMessage(walk: ActiveWalk, where: LatLng | null): string {
  const until = new Date(walk.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dest = walk.destination ? ` to ${walk.destination}` : "";
  const loc = where ? ` I'm starting here: ${mapsLink(where)}` : "";
  return `I'm walking${dest} and started a Safe Walk timer. I should check in by ${until}.${loc}`;
}

export function missedMessage(walk: ActiveWalk, where: LatLng | null): string {
  const dest = walk.destination ? ` to ${walk.destination}` : "";
  const loc = where ? ` My last known location: ${mapsLink(where)}` : "";
  return `I missed my Safe Walk check-in on my way${dest}. Please call or text me to make sure I'm OK.${loc}`;
}

// ---- React bindings ----------------------------------------------------------
// localStorage is an external store, so components read it with
// useSyncExternalStore instead of copying it into state from an effect.

let cached: SafeWalkState | null = null;
const listeners = new Set<() => void>();

function subscribeState(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getState(): SafeWalkState {
  cached ??= loadSafeWalk();
  return cached;
}

/** null during server render; the saved state on the device after that. */
export function useSafeWalk(): SafeWalkState | null {
  return useSyncExternalStore(subscribeState, getState, () => null);
}

export function setSafeWalk(next: SafeWalkState) {
  cached = next;
  saveSafeWalk(next);
  listeners.forEach((l) => l());
}

let clock = 0;
const tickers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(cb: () => void) {
  tickers.add(cb);
  if (!timer) {
    clock = Date.now();
    timer = setInterval(() => {
      clock = Date.now();
      tickers.forEach((t) => t());
    }, 1000);
  }
  return () => {
    tickers.delete(cb);
    if (!tickers.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time, updated every second while `running`. 0 on the server. */
export function useClock(running: boolean): number {
  const subscribe = useCallback((cb: () => void) => (running ? subscribeClock(cb) : () => {}), [running]);
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!running) return 0;
      if (!clock) clock = Date.now();
      return clock;
    },
    () => 0,
  );
}
