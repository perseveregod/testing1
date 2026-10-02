import { z } from "zod";
import { clientIp, json, parseBody, route } from "@/server/http";
import { currentUser, toViewer } from "@/server/auth/session";
import { linkSignIn } from "@/server/auth/email";

const schema = z.object({ accessToken: z.string().min(20).max(4096) });

export const POST = route(async (req: Request) => {
  const { accessToken } = await parseBody(req, schema);
  const user = await linkSignIn(accessToken, await currentUser(), clientIp(req));
  return json({ viewer: await toViewer(user) });
});
