import { CATEGORIES } from "@/lib/categories";
import { METERS_PER_MILE } from "@/lib/geo";
import type { CategoryId, Viewer } from "@/lib/types";
import { publicSource } from "../sources/registry";
import { getStore } from "../store";

// "Area insights": what has been happening around a point over the last N
// days, by category and by day. Demo data is excluded so trends are honest.

export interface AreaInsights {
  days: number;
  total: number;
  byCategory: { category: CategoryId; count: number; share: number }[];
  /** Oldest first; one bucket per day. */
  byDay: { date: string; count: number }[];
  busiestHour: number | null;
  /** This window vs. the one before it, as a ratio (1 = same). */
  trend: number | null;
  radiusMi: number;
}

const DAY = 86_400_000;

export async function areaInsights(
  center: { lat: number; lng: number },
  radiusMi: number,
  viewer: Viewer | null,
): Promise<AreaInsights> {
  const days = viewer?.limits.insightsDays ?? 7;
  const now = Date.now();
  const since = now - days * DAY;
  const records = await getStore().queryIncidents({
    center,
    radiusM: radiusMi * METERS_PER_MILE,
    since: new Date(since - days * DAY).toISOString(),
    limit: 500,
  });
  const real = records.filter((r) => publicSource(r.sourceId).kind !== "demo" && r.status !== "under_review");
  const current = real.filter((r) => new Date(r.createdAt).getTime() >= since);
  const previous = real.filter((r) => new Date(r.createdAt).getTime() < since);

  const counts = new Map<CategoryId, number>();
  const hours = new Array<number>(24).fill(0);
  const dayBuckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) dayBuckets.set(new Date(now - i * DAY).toISOString().slice(0, 10), 0);
  for (const r of current) {
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    const d = new Date(r.createdAt);
    hours[d.getUTCHours()]!++;
    const key = d.toISOString().slice(0, 10);
    if (dayBuckets.has(key)) dayBuckets.set(key, dayBuckets.get(key)! + 1);
  }
  const total = current.length;
  const byCategory = CATEGORIES.map((c) => ({ category: c.id, count: counts.get(c.id) ?? 0, share: total ? (counts.get(c.id) ?? 0) / total : 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const busiestHour = total ? hours.indexOf(Math.max(...hours)) : null;
  return {
    days,
    total,
    byCategory,
    byDay: [...dayBuckets.entries()].map(([date, count]) => ({ date, count })),
    busiestHour,
    trend: previous.length ? total / previous.length : null,
    radiusMi,
  };
}
