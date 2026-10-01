import { json, route } from "@/server/http";
import { currentUser } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const GET = route(async () => {
  const user = await currentUser();
  if (!user) return json({ items: [], unread: 0 });
  const items = await getStore().listNotifications(user.id, 100);
  return json({ items, unread: items.filter((n) => !n.readAt).length });
});
