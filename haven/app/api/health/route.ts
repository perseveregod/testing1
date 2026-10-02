import { config } from "@/server/config";
import { json } from "@/server/http";

export function GET() {
  return json({ ok: true, store: config.store.kind, billing: config.billing.mode });
}
