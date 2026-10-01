import { listQuerySchema } from "@/lib/validation";
import { jsonConditional, parseQuery, route } from "@/server/http";
import { currentViewer } from "@/server/auth/session";
import { ensureIngested } from "@/server/services/ingest";
import { listIncidents } from "@/server/services/incidents";

export const GET = route(async (req: Request) => {
  const q = parseQuery(req, listQuerySchema);
  // Lazy ingest keeps feeds fresh without a scheduler; it's a no-op when not due.
  await ensureIngested();
  const viewer = await currentViewer();
  const result = await listIncidents(q, viewer);
  return jsonConditional(req, result);
});

