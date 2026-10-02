import { timingSafeEqual } from "node:crypto";
import { config } from "@/server/config";
import { ApiError, json, route } from "@/server/http";
import { ingestAll } from "@/server/services/ingest";

// Scheduled ingest (see vercel.json). Vercel Cron sends
// `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set.
export const GET = route(async (req: Request) => {
  const secret = config.sources.cronSecret;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok =
    secret.length > 0 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) throw new ApiError(401, "Unauthorized", "unauthorized");
  // Not forced: each source keeps its own interval (live feeds every few
  // minutes, demo data every 90), so frequent schedulers don't churn the demo.
  return json({ results: await ingestAll(false) });
});
