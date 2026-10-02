import { z } from "zod";
import { clientIp, json, parseBody, route } from "@/server/http";
import { currentUser, requireUser } from "@/server/auth/session";
import { config } from "@/server/config";
import { getStore } from "@/server/store";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(256) }),
});

/** What the client needs to subscribe, and whether this account already has devices. */
export const GET = route(async () => {
  const user = await currentUser();
  const devices = user ? await getStore().countPushSubscriptions(user.id) : 0;
  return json({ enabled: config.push.enabled, publicKey: config.push.publicKey || null, devices });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  const sub = await parseBody(req, subscriptionSchema);
  await getStore().savePushSubscription({
    endpoint: sub.endpoint,
    userId: user.id,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    userAgent: (req.headers.get("user-agent") ?? "").slice(0, 200) || null,
    createdAt: new Date().toISOString(),
  });
  return json({ ok: true, devices: await getStore().countPushSubscriptions(user.id) }, 201);
});

export const DELETE = route(async (req: Request) => {
  await requireUser(clientIp(req));
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string().url().max(2048) }));
  await getStore().deletePushSubscription(endpoint);
  return json({ ok: true });
});
