import { emailStartSchema } from "@/lib/validation";
import { clientIp, json, parseBody, route } from "@/server/http";
import { startEmailSignIn } from "@/server/auth/email";

export const POST = route(async (req: Request) => {
  const { email } = await parseBody(req, emailStartSchema);
  const result = await startEmailSignIn(email, clientIp(req), new URL(req.url).origin);
  return json({ sent: true, ...result });
});
