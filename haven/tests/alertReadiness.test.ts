import { describe, expect, it } from "vitest";
import { alertReadiness, blockedHelp, type ReadinessInput } from "@/lib/alertReadiness";

const base: ReadinessInput = {
  prefs: { enabled: true, nearMe: false, savedPlaceAlerts: true },
  places: [],
  locationGranted: false,
  push: "off",
  verifiedAt: null,
};
const place = { alertsEnabled: true };

describe("alert readiness (what can actually be delivered)", () => {
  it("default switches with no saved place are not a working setup", () => {
    // The state a reviewer found: green switches, nothing behind them.
    const r = alertReadiness(base);
    expect(r.state).toBe("setup_needed");
    expect(r.hasArea).toBe(false);
    expect(r.placesSwitchIdle).toBe(true);
  });

  it("near-me counts only while the browser shares location", () => {
    const wanted = { ...base, prefs: { enabled: true, nearMe: true, savedPlaceAlerts: false } };
    expect(alertReadiness(wanted)).toMatchObject({ state: "setup_needed", nearMe: "blocked" });
    expect(alertReadiness({ ...wanted, locationGranted: true })).toMatchObject({ state: "inbox_only", nearMe: "on" });
  });

  it("a place whose own alerts are off doesn't count, nor does one behind an off switch", () => {
    expect(alertReadiness({ ...base, places: [{ alertsEnabled: false }] }).state).toBe("setup_needed");
    expect(alertReadiness({ ...base, places: [place], prefs: { enabled: true, nearMe: false, savedPlaceAlerts: false } }).state).toBe("setup_needed");
  });

  it("an area without push on this device is inbox only, whatever the reason", () => {
    for (const push of ["off", "denied", "install", "unsupported", "setup", "loading"] as const) {
      expect(alertReadiness({ ...base, places: [place], push }).state).toBe("inbox_only");
    }
  });

  it("push is only called ready after a test has arrived", () => {
    expect(alertReadiness({ ...base, places: [place], push: "on" }).state).toBe("push_untested");
    expect(alertReadiness({ ...base, places: [place], push: "on", verifiedAt: 1 }).state).toBe("push_ready");
    // A stale verification never upgrades a device that isn't subscribed any more.
    expect(alertReadiness({ ...base, places: [place], push: "denied", verifiedAt: 1 }).state).toBe("inbox_only");
  });

  it("alerts switched off is its own state", () => {
    expect(alertReadiness({ ...base, places: [place], push: "on", verifiedAt: 1, prefs: { enabled: false, nearMe: true, savedPlaceAlerts: true } }).state).toBe("off");
    expect(alertReadiness({ ...base, prefs: null }).state).toBe("off");
  });
});

describe("instructions for blocked notifications", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
  const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  const EDGE = CHROME + " Edg/126.0.0.0";
  const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0";
  const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

  it("matches the browser the person is in", () => {
    expect(blockedHelp(IPHONE, true)).toBe("ios_app");
    expect(blockedHelp(SAFARI, false, 5)).toBe("ios_app"); // iPad reports as a Mac with touch
    expect(blockedHelp(ANDROID, false)).toBe("android_chrome");
    expect(blockedHelp(ANDROID, true)).toBe("android_app");
    expect(blockedHelp(CHROME, false)).toBe("desktop_chromium");
    expect(blockedHelp(EDGE, false)).toBe("desktop_chromium");
    expect(blockedHelp(FIREFOX, false)).toBe("firefox");
    expect(blockedHelp(SAFARI, false)).toBe("safari_mac");
    expect(blockedHelp("SomethingElse/1.0", false)).toBe("generic");
  });
});
