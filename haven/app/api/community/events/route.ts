import { createEventSchema, eventsQuerySchema } from "@/lib/validation";
import { clientIp, json, parseBody, parseQuery, route } from "@/server/http";
import { currentUser, requireUser } from "@/server/auth/session";
import { createCommunityEvent, listCommunityEvents } from "@/server/services/community";

export const GET = route(async (req: Request) => {
  const q = parseQuery(req, eventsQuerySchema);
  const user = await currentUser();
  const events = await listCommunityEvents(q, user);
  return json({ events });
});

export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  const user = await requireUser(ip);
  const input = await parseBody(req, createEventSchema);
  const event = await createCommunityEvent(input, user, ip);
  return json({ event }, 201);
});
