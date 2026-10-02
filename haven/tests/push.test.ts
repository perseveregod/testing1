import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) } }));
vi.mock("@/server/auth/session", async (orig) => ({ ...(await orig<typeof import("@/server/auth/session")>()), setSessionCookie: async () => {} }));

import { LocalStore } from "@/server/store/local";
import { setStoreForTests } from "@/server/store";
import { createReport } from "@/server/services/incidents";
import { config } from "@/server/config";

const P = { lat: 29.76, lng: -95.37 };
let store: LocalStore;
let ipN = 0;
const ip = () => `10.1.0.${++ipN}`;

beforeEach(() => {
  store = new LocalStore(null);
  setStoreForTests(store);
  sendNotification.mockReset();
  vi.stubEnv("INCIDENT_SOURCES", "none");
});

async function listener() {
  const u = await store.createUser({ email: null, displayName: "l" });
  await store.insertPlace(u.id, { id: `p-${u.id}`, kind: "home", label: "Home", latitude: P.lat + 0.01, longitude: P.lng, address: "", alertsEnabled: true, radiusMi: null, categories: null, createdAt: new Date().toISOString() });
  return u;
}

describe("push delivery", () => {
  it("is a quiet no-op without VAPID keys", async () => {
    const u = await listener();
    await store.savePushSubscription({ endpoint: "https://push.example/a", userId: u.id, p256dh: "k", auth: "a", userAgent: null, createdAt: new Date().toISOString() });
    const reporter = await store.createUser({ email: null, displayName: "r" });
    await createReport({ category: "fire", latitude: P.lat, longitude: P.lng, description: "smoke" }, reporter, ip());
    expect(await store.listNotifications(u.id, 5)).toHaveLength(1);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("pushes to every device of an alerted user and drops dead endpoints", async () => {
    Object.defineProperty(config.push, "enabled", { get: () => true, configurable: true });
    const u = await listener();
    const other = await listener();
    const t = new Date().toISOString();
    await store.savePushSubscription({ endpoint: "https://push.example/phone", userId: u.id, p256dh: "k1", auth: "a1", userAgent: "iPhone", createdAt: t });
    await store.savePushSubscription({ endpoint: "https://push.example/laptop", userId: u.id, p256dh: "k2", auth: "a2", userAgent: null, createdAt: t });
    await store.savePushSubscription({ endpoint: "https://push.example/gone", userId: other.id, p256dh: "k3", auth: "a3", userAgent: null, createdAt: t });
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("/gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      return { statusCode: 201 };
    });

    const reporter = await store.createUser({ email: null, displayName: "r" });
    await createReport({ category: "fire", latitude: P.lat, longitude: P.lng, description: "smoke" }, reporter, ip());
    // Delivery is fire-and-forget after the inbox insert.
    await new Promise((r) => setTimeout(r, 20));

    expect(sendNotification).toHaveBeenCalledTimes(3);
    const payload = JSON.parse(sendNotification.mock.calls[0]![1] as string);
    expect(payload.url).toMatch(/^\/incidents\//);
    expect(payload.title).toMatch(/Fire/);
    expect(await store.countPushSubscriptions(u.id)).toBe(2);
    expect(await store.countPushSubscriptions(other.id)).toBe(0);
  });
});
