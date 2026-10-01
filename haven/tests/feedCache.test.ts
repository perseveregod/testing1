import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny localStorage for Node.
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

import { readFeedCache, resetFeedCacheForTests, writeFeedCache } from "@/lib/client/feedCache";
import { nearYouParams, type IncidentsResponse } from "@/lib/client/hooks";
import type { PublicIncident } from "@/lib/types";

const inc = (id: string, category: PublicIncident["category"]) => ({ id, category }) as PublicIncident;
const data: IncidentsResponse = { items: [inc("a", "fire"), inc("b", "police")], sinceHours: 24, historyLimited: false };
const HOME = { lat: 29.861, lng: -95.419 };

describe("feed cache (last near-you answer on this device)", () => {
  beforeEach(() => {
    mem.clear();
    resetFeedCacheForTests();
  });

  it("stands in for the same query, and for one centered a short walk away", () => {
    writeFeedCache(nearYouParams(HOME), data, 1000);
    expect(readFeedCache(nearYouParams(HOME), 2000)?.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(readFeedCache(nearYouParams({ lat: 29.864, lng: -95.421 }), 2000)).toBeDefined();
    // Across town is a different list.
    expect(readFeedCache(nearYouParams({ lat: 29.76, lng: -95.37 }), 2000)).toBeUndefined();
  });

  it("cuts a category view out of the stored list instead of waiting", () => {
    writeFeedCache(nearYouParams(HOME), data, 1000);
    const fire = readFeedCache(nearYouParams(HOME, { categories: ["fire"] }), 2000);
    expect(fire?.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("only remembers the shared near-you query, never a map viewport or a filtered one", () => {
    writeFeedCache({ center: HOME, radiusMi: 25, sort: "newest", limit: 200 }, data, 1000);
    writeFeedCache(nearYouParams(HOME, { categories: ["fire"] }), data, 1000);
    writeFeedCache(nearYouParams(HOME, { sinceHours: 6 }), data, 1000);
    expect(readFeedCache(nearYouParams(HOME), 2000)).toBeUndefined();
  });

  it("expires after half a day", () => {
    writeFeedCache(nearYouParams(HOME), data, 0);
    expect(readFeedCache(nearYouParams(HOME), 11 * 3_600_000)).toBeDefined();
    expect(readFeedCache(nearYouParams(HOME), 13 * 3_600_000)).toBeUndefined();
  });
});
