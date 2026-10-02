import { json, route } from "@/server/http";
import { currentUser } from "@/server/auth/session";
import { getStore } from "@/server/store";
import { sampleAlerts } from "@/server/services/alerts";
import { ensureIngested } from "@/server/services/ingest";

export const GET = route(async () => {
  const user = await currentUser();
  const items = user ? await getStore().listNotifications(user.id, 100) : [];
  const unread = items.filter((n) => !n.readAt).length;
  if (items.length > 0) return json({ items, unread });
  // Nothing real yet: in demo mode, show samples so the inbox explains itself.
  await ensureIngested();
  return json({ items: await sampleAlerts(), unread: 0 });
});
