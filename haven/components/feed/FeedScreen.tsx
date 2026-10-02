"use client";

import { useCallback, useMemo, useState } from "react";
import { ListX, MapPinned, Navigation } from "lucide-react";
import { categoriesInGroup, type FilterGroup } from "@/lib/categories";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { distanceFrom, nearYouParams, useFeedFreshness, useHydrated, useIncidents, type InitialIncidents } from "@/lib/client/hooks";
import { useAffects } from "@/lib/client/affects";
import { useArrivals, useScrolledPast } from "@/lib/client/arrivals";
import { useClock } from "@/lib/client/safewalk";
import { errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/client/lang";
import { neighborhoodFor } from "@/lib/houston";
import type { Key } from "@/lib/i18n";
import { useLocation } from "@/components/providers/LocationProvider";
import {
  foldDuplicates,
  IncidentRow,
  timeSection,
  pickTopIncident,
  TopIncidentCard,
} from "@/components/incident/IncidentCard";
import { EmergencyNote } from "@/components/EmergencyNote";
import { DemoNotice } from "@/components/incident/DemoNotice";
import { PageHeader } from "@/components/nav/PageHeader";
import { LiveStatus, NewItemsPill } from "@/components/feed/LiveStatus";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Controls";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/ui/States";
import { PullToRefresh } from "@/components/ui/PullToRefresh";

type FeedFilter = "nearby" | "newest" | FilterGroup;

const FILTERS: { id: FeedFilter; label: Key }[] = [
  { id: "nearby", label: "feed.nearby" },
  { id: "newest", label: "feed.newest" },
  { id: "police", label: "map.group.police" },
  { id: "fire", label: "map.group.fire" },
  { id: "medical", label: "map.group.medical" },
  { id: "traffic", label: "map.group.traffic" },
  { id: "weather", label: "map.group.weather" },
  { id: "other", label: "map.group.other" },
];

export function FeedScreen({ initial }: { initial?: InitialIncidents | null }) {
  const { position, lastPosition, status, request } = useLocation();
  const { t } = useT();
  const now = useClock(true, 30_000);
  const fresh = useFeedFreshness(now);
  const [filter, setFilter] = useState<FeedFilter>("nearby");
  // Mount a short list first; the rest comes on request. Keeps the tab instant.
  const [limit, setLimit] = useState(30);
  // Where the person last was stands in until the live fix arrives, so the
  // list opens on their part of town instead of downtown.
  const hydrated = useHydrated();
  const here = lastPosition;
  // (Null while hydrating: the remembered position isn't readable yet, and
  // asking for downtown in the meantime would be a wasted download.)
  const center = hydrated ? (here ?? DEFAULT_CENTER) : null;
  const hood = here ? neighborhoodFor(here) : null;
  const isGroup = filter !== "nearby" && filter !== "newest";

  // Same query (and cache entry) as the map's count, so the tab opens with
  // data already in hand; distance ordering happens here, not on the server.
  const { items, error, isLoading, mutate } = useIncidents(
    nearYouParams(center, { categories: isGroup ? categoriesInGroup(filter) : undefined }),
    initial,
  );
  // Rows that came in since the last answer glow briefly; while scrolled
  // down, a pill counts them until the person is back at the top.
  // "0.4 mi from Home": one lookup for the whole list.
  const affectsOf = useAffects();
  const scrolled = useScrolledPast(240);
  const { arrived, pending } = useArrivals(items, { scrolled });

  const sorted = useMemo(() => {
    // One row per event, live ones first (nearest or newest), then what ended.
    const folded = foldDuplicates(items);
    const byDistance = filter === "nearby" && here;
    return [...folded].sort(
      (a, b) =>
        Number(a.status === "resolved") - Number(b.status === "resolved") ||
        (byDistance ? (distanceFrom(here, a) ?? 0) - (distanceFrom(here, b) ?? 0) : b.createdAt.localeCompare(a.createdAt)),
    );
  }, [items, filter, here]);

  const activeCount = items.filter((i) => i.status !== "resolved").length;
  const allDemo = items.length > 0 && items.every((i) => i.isDemo);
  const refresh = useCallback(() => mutate(), [mutate]);
  const top = useMemo(
    () => (isGroup ? null : pickTopIncident(items)),
    [items, isGroup],
  );
  const rest = useMemo(
    () => (top ? sorted.filter((i) => i.id !== top.id) : sorted),
    [sorted, top],
  );

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader
        title={t("feed.title")}
        large
        sub={
          <div
            className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3 pt-1"
            role="toolbar"
            aria-label={t("feed.filters")}
          >
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                active={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {t(f.label)}
              </Chip>
            ))}
          </div>
        }
      />
      <NewItemsPill count={pending} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
      <PullToRefresh onRefresh={refresh}>
        <div className="relative mx-auto max-w-lg px-4">
          {position && hood && (
            <p className="mb-1 mt-1 flex min-h-8 items-center gap-2 text-[13px] text-muted">
              <Navigation className="size-4 shrink-0 text-brand" aria-hidden />
              {t("near.hoodWithin", { hood, n: 5 })}
            </p>
          )}
          {!position && (
            <button
              onClick={request}
              disabled={status === "denied" || status === "unavailable"}
              className="press mb-1 mt-1 flex min-h-11 w-full items-center gap-2 text-left disabled:opacity-100"
            >
              <Navigation className="size-4 shrink-0 text-brand" aria-hidden />
              <span className="truncate text-[13px] text-muted">
                {hood ? t("near.hoodWithin", { hood, n: 5 }) : t("feed.showingCentral")}
                {status === "denied" || status === "unavailable" ? (
                  <span className="text-faint">{t("feed.locationOff")}</span>
                ) : (
                  <span className="font-semibold text-brand"> · {t("common.useMyLocation")}</span>
                )}
              </span>
            </button>
          )}

          {!isLoading && !error && top && (
            <TopIncidentCard
              incident={top}
              distanceMi={distanceFrom(here, top)}
            />
          )}

          {!isLoading && !error && allDemo && <DemoNotice />}

          {/* Shown for an empty list too: "nothing listed" only means something next to when the feeds were last checked. */}
          {!isLoading && !error && (
            <LiveStatus activeCount={activeCount} checkedAt={fresh.checkedAt} stale={fresh.stale} now={now} />
          )}

          <div className="stagger divide-y divide-line">
            {isLoading ? (
              Array.from({ length: 5 }, (_, i) => <RowSkeleton key={i} />)
            ) : error ? (
              <ErrorState
                message={errorMessage(error)}
                onRetry={() => mutate()}
              />
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={
                  <ListX
                    className="size-9"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                }
                title={hood ? t("near.quietIn", { hood }) : t("feed.quiet")}
                body={isGroup ? t("feed.quietCategory") : t("feed.quietAll")}
                action={
                  <ButtonLink
                    href="/"
                    variant="secondary"
                    transitionTypes={["tab"]}
                  >
                    <MapPinned className="size-4" aria-hidden /> {t("feed.explore")}
                  </ButtonLink>
                }
              />
            ) : (
              rest.slice(0, limit).map((i, idx) => {
                const section = timeSection(i);
                const prev = idx > 0 ? rest[idx - 1] : null;
                const showHeader = !prev || timeSection(prev) !== section;
                return (
                  <div
                    key={i.id}
                    data-arrived={arrived.has(i.id) ? "" : undefined}
                    style={{ "--i": Math.min(idx, 10) } as React.CSSProperties}
                  >
                    {showHeader && (
                      <h2 className="t-section -mx-4 bg-transparent px-4 pb-1 pt-5">{t(section)}</h2>
                    )}
                    <IncidentRow incident={i} distanceMi={distanceFrom(here, i)} affects={affectsOf(i)} />
                  </div>
                );
              })
            )}
          </div>
          {!isLoading && !error && rest.length > limit && (
            <button
              onClick={() => setLimit((n) => n + 50)}
              className="press mt-2 flex min-h-12 w-full items-center justify-center rounded-card bg-surface text-[14px] font-semibold text-brand"
            >
              {t("common.showMore", { n: Math.min(50, rest.length - limit) })}
            </button>
          )}

          <div className="mt-8">
            <EmergencyNote inline />
          </div>
        </div>
      </PullToRefresh>
    </main>
  );
}
