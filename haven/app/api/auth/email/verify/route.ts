import { emailVerifySchema } from "@/lib/validation";
import { clientIp, json, parseBody, route } from "@/server/http";
import { currentUser, toViewer } from "@/server/auth/session";
import { verifyEmailSignIn } from "@/server/auth/email";

export const POST = route(async (req: Request) => {
  const { email, code } = await parseBody(req, emailVerifySchema);
  const user = await verifyEmailSignIn(email, code, await currentUser(), clientIp(req));
  return json({ viewer: await toViewer(user) });
});
