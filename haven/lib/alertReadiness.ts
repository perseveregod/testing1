// Whether alerts can actually reach someone, kept apart from what they have
// switched on. A green switch is a preference; this is the truth about
// delivery. Pure, so every state can be tested.

/** Where this device stands with notifications (see lib/client/push.ts). */
export type PushDevice = "unsupported" | "install" | "setup" | "denied" | "off" | "on" | "loading";

export type Readiness =
  /** Alerts are switched off. */
  | "off"
  /** On, but there is no area to watch, so nothing can ever be sent. */
  | "setup_needed"
  /** An area is set; alerts are saved to the inbox, and this device won't be notified. */
  | "inbox_only"
  /** Notifications are allowed here, but no test has been seen arriving. */
  | "push_untested"
  /** A test notification reached this device. */
  | "push_ready";

export interface ReadinessInput {
  prefs: { enabled: boolean; nearMe: boolean; savedPlaceAlerts: boolean } | null;
  /** Saved places, with each one's own alert switch. */
  places: { alertsEnabled: boolean }[];
  /** Does the browser currently share location with Haven? */
  locationGranted: boolean;
  push: PushDevice;
  /** When a test notification last arrived on this device, if ever. */
  verifiedAt: number | null;
}

export interface ReadinessResult {
  state: Readiness;
  /** Saved places that alerts are actually on for. */
  watchedPlaces: number;
  /** "Near me": working, wanted but location is off, or not wanted. */
  nearMe: "on" | "blocked" | "off";
  /** Something is being watched. */
  hasArea: boolean;
  /** The saved-places switch is on but there is nothing behind it. */
  placesSwitchIdle: boolean;
}

export function alertReadiness(i: ReadinessInput): ReadinessResult {
  const prefs = i.prefs;
  const watchedPlaces = prefs?.savedPlaceAlerts ? i.places.filter((p) => p.alertsEnabled).length : 0;
  const nearMe: ReadinessResult["nearMe"] = !prefs?.nearMe ? "off" : i.locationGranted ? "on" : "blocked";
  const hasArea = watchedPlaces > 0 || nearMe === "on";
  const placesSwitchIdle = Boolean(prefs?.savedPlaceAlerts) && watchedPlaces === 0;

  let state: Readiness;
  if (!prefs || !prefs.enabled) state = "off";
  else if (!hasArea) state = "setup_needed";
  else if (i.push !== "on") state = "inbox_only";
  else state = i.verifiedAt != null ? "push_ready" : "push_untested";
  return { state, watchedPlaces, nearMe, hasArea, placesSwitchIdle };
}

/** Which instructions un-block notifications on this browser. */
export type BlockedHelp = "ios_app" | "android_app" | "android_chrome" | "firefox" | "safari_mac" | "desktop_chromium" | "generic";

export function blockedHelp(userAgent: string, standalone: boolean, maxTouchPoints = 0): BlockedHelp {
  const ua = userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (ios) return "ios_app"; // on iPhone, notifications only exist for the Home Screen app
  if (/Android/.test(ua)) return standalone ? "android_app" : /Firefox/.test(ua) ? "firefox" : "android_chrome";
  if (/Firefox/.test(ua)) return "firefox";
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return "safari_mac";
  if (/Chrome|Chromium|Edg\//.test(ua)) return "desktop_chromium";
  return "generic";
}
