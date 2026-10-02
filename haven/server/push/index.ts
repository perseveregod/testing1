import webpush from "web-push";
import type { NotificationItem } from "@/lib/types";
import { config } from "../config";
import { getStore } from "../store";
import type { PushSubscriptionRecord } from "../store/types";

// Web Push delivery for alerts. Needs VAPID keys (see server/config.ts);
// without them everything here is a quiet no-op and alerts stay in-app.

let configured = false;
function ready(): boolean {
  if (!config.push.enabled) return false;
  if (!configured) {
    webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
    configured = true;
  }
  return true;
}

export function pushEnabled(): boolean {
  return config.push.enabled;
}

/** The payload the service worker turns into a system notification. */
export interface PushPayload {
  title: string;
  body: string;
  /** Path to open when tapped. */
  url: string;
  tag: string;
  /** Unread count for the app badge, when known. */
  badge?: number;
}

/**
 * Sends one notification to every device of each user. Dead subscriptions
 * (410/404 from the push service) are removed. Returns deliveries attempted.
 */
export async function sendPush(items: (NotificationItem & { userId: string })[]): Promise<number> {
  if (!ready() || items.length === 0) return 0;
  const store = getStore();
  const subs = await store.listPushSubscriptions([...new Set(items.map((i) => i.userId))]);
  if (subs.length === 0) return 0;
  const byUser = new Map<string, PushSubscriptionRecord[]>();
  for (const s of subs) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);

  let sent = 0;
  await Promise.all(
    items.flatMap((item) =>
      (byUser.get(item.userId) ?? []).map(async (sub) => {
        const payload: PushPayload = {
          title: item.title,
          body: item.body,
          url: `/incidents/${item.incidentId}`,
          tag: `incident-${item.incidentId}`,
        };
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60, urgency: item.severity === "critical" || item.severity === "high" ? "high" : "normal" },
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await store.deletePushSubscription(sub.endpoint);
          else console.warn("[haven] push failed", status, (err as Error).message);
        }
      }),
    ),
  );
  return sent;
}

/** A one-off "it works" notification to a single user's devices. */
export async function sendTestPush(userId: string): Promise<number> {
  if (!ready()) return 0;
  const subs = await getStore().listPushSubscriptions([userId]);
  let sent = 0;
  for (const sub of subs) {
    const payload: PushPayload = {
      title: "Haven alerts are on",
      body: "You'll hear about incidents near your places, and nothing else.",
      url: "/alerts",
      tag: "haven-test",
    };
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 300 });
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await getStore().deletePushSubscription(sub.endpoint);
    }
  }
  return sent;
}
