import { listQuerySchema } from "@/lib/validation";
import { json, parseQuery, route } from "@/server/http";
import { currentViewer } from "@/server/auth/session";
import { ingestAll } from "@/server/services/ingest";
import { listIncidents } from "@/server/services/incidents";

export const GET = route(async (req: Request) => {
  const q = parseQuery(req, listQuerySchema);
  // Lazy ingest keeps feeds fresh without a scheduler; it's a no-op when not due.
  // The first load waits (so demo data exists); later refreshes run in the background.
  const ingest = ingestAll().catch((err) => console.warn("[haven] ingest failed", err));
  if (!globalThis.__havenIngestedOnce) {
    await ingest;
    globalThis.__havenIngestedOnce = true;
  }
  const viewer = await currentViewer();
  const result = await listIncidents(q, viewer);
  return json(result);
});

declare global {
  var __havenIngestedOnce: boolean | undefined;
}
