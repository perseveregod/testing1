import { clientIp, json, route } from "@/server/http";
import { createToken, requireUser, toViewer } from "@/server/auth/session";

// Returns the current account, creating a private guest account on first visit.
// Native clients send `X-Haven-Client: native` to receive a bearer token.
export const GET = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  const viewer = await toViewer(user);
  const native = req.headers.get("x-haven-client") === "native";
  return json({ viewer, ...(native ? { token: createToken(user.id) } : {}) });
});
