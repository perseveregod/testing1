import { createHash, randomUUID } from "node:crypto";
import type { IncidentRecord } from "@/lib/types";
import { config } from "../config";
import { ADAPTERS } from "../sources/registry";
import type { SourceAdapter } from "../sources/types";
import { getStore } from "../store";
import { dispatchAlerts } from "./alerts";

// Pulls every enabled source and upserts its incidents. Runs from the cron
// endpoint in production and lazily (at most every INGEST_INTERVAL_MIN) when
// the map loads, so local development needs no scheduler.

const DEMO_REFRESH_MS = 6 * 3_600_000;
const NOTIFY_IF_NEWER_THAN_MS = 30 * 60_000;

export interface IngestResult {
  source: string;
  fetched: number;
  inserted: number;
  updated: number;
  resolved: number;
  error?: string;
}

let running: Promise<IngestResult[]> | null = null;

/**
 * Demo incidents get IDs derived from their source and external ID, so every
 * server instance (each Vercel function has its own in-memory store) hands out
 * the same ID for the same incident and links keep working across instances.
 */
export function stableIncidentId(sourceId: string, externalId: string): string {
  const h = createHash("sha256").update(`${sourceId}:${externalId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Make sure this instance has data before answering. The first request waits;
 * later ones refresh in the background (a no-op when nothing is due).
 */
export async function ensureIngested(): Promise<void> {
  const ingest = ingestAll().catch((err) => console.warn("[haven] ingest failed", err));
  if (!globalThis.__havenIngestedOnce) {
    await ingest;
    globalThis.__havenIngestedOnce = true;
  }
}

declare global {
  var __havenIngestedOnce: boolean | undefined;
}

export function enabledAdapters(): SourceAdapter[] {
  const on = new Set(config.sources.enabled);
  return ADAPTERS.filter((a) => on.has(a.meta.id));
}

/** Ingest sources that are due. `force` ignores the interval. */
export function ingestAll(force = false): Promise<IngestResult[]> {
  if (!running) {
    running = runIngest(force).finally(() => {
      running = null;
    });
  }
  return running;
}

async function runIngest(force: boolean): Promise<IngestResult[]> {
  const store = getStore();
  const known = new Map((await store.listSources()).map((s) => [s.id, s]));
  const results: IngestResult[] = [];
  const now = new Date();

  for (const adapter of enabledAdapters()) {
    const prev = known.get(adapter.meta.id);
    const last = prev?.lastSyncedAt ? new Date(prev.lastSyncedAt).getTime() : 0;
    const due = adapter.rolling
      ? now.getTime() - last > DEMO_REFRESH_MS
      : now.getTime() - last > config.sources.ingestIntervalMin * 60_000;
    if (!force && !due) continue;

    // Record the attempt first so a failing source isn't retried on every request.
    await store.upsertSource({ ...adapter.meta, enabled: true, lastSyncedAt: now.toISOString() });
    try {
      results.push(await ingestOne(adapter, now));
    } catch (err) {
      console.warn(`[haven] ingest ${adapter.meta.id} failed:`, (err as Error).message);
      results.push({ source: adapter.meta.id, fetched: 0, inserted: 0, updated: 0, resolved: 0, error: (err as Error).message });
    }
  }
  return results;
}

async function ingestOne(adapter: SourceAdapter, now: Date): Promise<IngestResult> {
  const store = getStore();
  const sourceId = adapter.meta.id;
  const items = await adapter.fetch({
    now,
    demoCenter: config.sources.demoCenter,
    userAgent: `Haven/0.1 (${config.sources.contactEmail || "community safety app"})`,
  });
  const result: IngestResult = { source: sourceId, fetched: items.length, inserted: 0, updated: 0, resolved: 0 };

  // Demo data is regenerated wholesale so its timestamps stay recent.
  if (adapter.rolling) await store.deleteIncidentsBySource(sourceId);

  const seen = new Set<string>();
  for (const item of items) {
    seen.add(item.externalId);
    const existing = adapter.rolling ? null : await store.getIncidentByExternalId(sourceId, item.externalId);
    if (!existing) {
      const rec: IncidentRecord = {
        id: adapter.rolling ? stableIncidentId(sourceId, item.externalId) : randomUUID(),
        category: item.category,
        title: item.title,
        description: item.description,
        latitude: item.latitude,
        longitude: item.longitude,
        approximateAddress: item.approximateAddress,
        severity: item.severity,
        status: item.status,
        sourceId,
        externalId: item.externalId,
        reporterId: null,
        createdAt: item.observedAt,
        updatedAt: item.observedAt,
        confirmationCount: 0,
        endedCount: 0,
        flagCount: 0,
        mergedIntoId: null,
      };
      await store.insertIncident(rec);
      await store.insertUpdate({
        id: randomUUID(),
        incidentId: rec.id,
        kind: "created",
        body: `Reported by ${adapter.meta.name}.`,
        authorId: null,
        createdAt: item.observedAt,
      });
      result.inserted++;
      const fresh = now.getTime() - new Date(item.observedAt).getTime() < NOTIFY_IF_NEWER_THAN_MS;
      if (adapter.notify && fresh && rec.status === "active") await dispatchAlerts(rec, null);
      continue;
    }

    const changed =
      existing.status !== item.status ||
      existing.severity !== item.severity ||
      existing.description !== item.description;
    if (changed) {
      await store.updateIncident(existing.id, {
        status: existing.status === "under_review" ? existing.status : item.status,
        severity: item.severity,
        description: item.description,
        title: item.title,
        updatedAt: now.toISOString(),
      });
      if (existing.status !== item.status) {
        await store.insertUpdate({
          id: randomUUID(),
          incidentId: existing.id,
          kind: "source_update",
          body: item.status === "resolved" ? "Source reports this has ended." : `Source updated status to ${item.status}.`,
          authorId: null,
          createdAt: now.toISOString(),
        });
      }
      result.updated++;
    }
  }

  if (adapter.authoritativeActiveSet) {
    const active = await store.queryIncidents({
      since: new Date(now.getTime() - 14 * 24 * 3_600_000).toISOString(),
      limit: 500,
    });
    for (const inc of active) {
      if (inc.sourceId !== sourceId || inc.status !== "active" || !inc.externalId) continue;
      if (seen.has(inc.externalId)) continue;
      await store.updateIncident(inc.id, { status: "resolved", updatedAt: now.toISOString() });
      await store.insertUpdate({
        id: randomUUID(),
        incidentId: inc.id,
        kind: "source_update",
        body: "No longer listed as active by the source.",
        authorId: null,
        createdAt: now.toISOString(),
      });
      result.resolved++;
    }
  }
  return result;
}
