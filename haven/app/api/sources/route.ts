import { jsonConditional, route } from "@/server/http";
import { ADAPTERS, USER_SOURCE } from "@/server/sources/registry";
import { enabledAdapters } from "@/server/services/ingest";
import { getStore } from "@/server/store";

export const GET = route(async (req: Request) => {
  const synced = new Map((await getStore().listSources()).map((s) => [s.id, s.lastSyncedAt ?? null]));
  const on = new Set(enabledAdapters().map((a) => a.meta.id));
  const sources = [
    { ...USER_SOURCE, enabled: true, lastSyncedAt: null },
    ...ADAPTERS.map((a) => ({ ...a.meta, enabled: on.has(a.meta.id), lastSyncedAt: synced.get(a.meta.id) ?? null })),
  ];
  return jsonConditional(req, { sources });
});
