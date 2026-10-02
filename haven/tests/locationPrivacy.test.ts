import { beforeEach, describe, expect, it } from "vitest";
import { LocalStore } from "@/server/store/local";
import { setStoreForTests } from "@/server/store";
import { DEFAULT_ALERT_PREFS, forgetLocation, nearMeActive, rememberLocation, saveAlertPrefs } from "@/server/services/alerts";

// What the app tells people about location has to be what the server does:
// one rounded point, kept only while "alerts near me" is in effect.

let store: LocalStore;
const EXACT = { lat: 29.760427, lng: -95.369803 };
const nearMeOn = { ...DEFAULT_ALERT_PREFS, enabled: true, nearMe: true };

async function newUser() {
  return store.createUser({ email: null, displayName: "t" });
}
async function stored(id: string) {
  const u = await store.getUser(id);
  return { lat: u!.lastLat, lng: u!.lastLng, at: u!.lastLocationAt };
}

beforeEach(() => {
  store = new LocalStore(null);
  setStoreForTests(store);
});

describe("the location kept for near-me alerts", () => {
  it("is refused while near-me alerts are off (the default)", async () => {
    const u = await newUser();
    expect(await rememberLocation(u.id, EXACT)).toBe(false);
    expect(await stored(u.id)).toEqual({ lat: null, lng: null, at: null });
  });

  it("is rounded to 0.01 degrees: never the exact point, always within about half a mile", async () => {
    const u = await newUser();
    await saveAlertPrefs(u.id, nearMeOn);
    expect(await rememberLocation(u.id, EXACT)).toBe(true);
    const s = await stored(u.id);
    expect(s.lat).toBe(29.76);
    expect(s.lng).toBe(-95.37);
    expect(s.at).not.toBeNull();
  });

  it("is deleted when near-me alerts are turned off", async () => {
    const u = await newUser();
    await saveAlertPrefs(u.id, nearMeOn);
    await rememberLocation(u.id, EXACT);
    await saveAlertPrefs(u.id, { ...nearMeOn, nearMe: false });
    expect(await stored(u.id)).toEqual({ lat: null, lng: null, at: null });
  });

  it("is deleted when all alerts are turned off, even with near-me left on", async () => {
    const u = await newUser();
    await saveAlertPrefs(u.id, nearMeOn);
    await rememberLocation(u.id, EXACT);
    await saveAlertPrefs(u.id, { ...nearMeOn, enabled: false });
    expect(await stored(u.id)).toEqual({ lat: null, lng: null, at: null });
    // And it can't be stored again until alerts are back on.
    expect(await rememberLocation(u.id, EXACT)).toBe(false);
  });

  it("is kept when an unrelated preference changes", async () => {
    const u = await newUser();
    await saveAlertPrefs(u.id, nearMeOn);
    await rememberLocation(u.id, EXACT);
    await saveAlertPrefs(u.id, { ...nearMeOn, radiusMi: 1 });
    expect((await stored(u.id)).lat).toBe(29.76);
  });

  it("can be deleted on request (location blocked in the browser)", async () => {
    const u = await newUser();
    await saveAlertPrefs(u.id, nearMeOn);
    await rememberLocation(u.id, EXACT);
    await forgetLocation(u.id);
    expect(await stored(u.id)).toEqual({ lat: null, lng: null, at: null });
  });

  it("only counts as active with both switches on", () => {
    expect(nearMeActive(nearMeOn)).toBe(true);
    expect(nearMeActive({ enabled: false, nearMe: true })).toBe(false);
    expect(nearMeActive({ enabled: true, nearMe: false })).toBe(false);
    expect(nearMeActive(null)).toBe(false);
  });
});
