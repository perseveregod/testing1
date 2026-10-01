"use client";

import { useCallback, useMemo, useState } from "react";
import { MapPinned, Navigation, ShieldCheck } from "lucide-react";
import { categoriesInGroup, type FilterGroup } from "@/lib/categories";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { activeLabel, distanceFrom, nearYouParams, useIncidents, useViewer, type InitialIncidents } from "@/lib/client/hooks";
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
  const { position, status, request } = useLocation();
  const { viewer } = useViewer();
  const { t, es } = useT();
  const [filter, setFilter] = useState<FeedFilter>("nearby");
  // Mount a short list first; the rest comes on request. Keeps the tab instant.
  const [limit, setLimit] = useState(30);
  const center = position ?? DEFAULT_CENTER;
  const hood = position ? neighborhoodFor(position) : null;
  const isGroup = filter !== "nearby" && filter !== "newest";

  // Same query (and cache entry) as the map's count, so the tab opens with
  // data already in hand; distance ordering happens here, not on the server.
  const { items, error, isLoading, mutate } = useIncidents(
    nearYouParams(center, { categories: isGroup ? categoriesInGroup(filter) : undefined }),
    initial,
  );

  const sorted = useMemo(() => {
    // One row per event, live ones first (nearest or newest), then what ended.
    const folded = foldDuplicates(items);
    const byDistance = filter === "nearby" && position;
    return [...folded].sort(
      (a, b) =>
        Number(a.status === "resolved") - Number(b.status === "resolved") ||
        (byDistance ? (distanceFrom(position, a) ?? 0) - (distanceFrom(position, b) ?? 0) : b.createdAt.localeCompare(a.createdAt)),
    );
  }, [items, filter, position]);

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
      <PullToRefresh onRefresh={refresh}>
        <div className="relative mx-auto max-w-lg px-4">
          {position && hood && (
            <p className="mb-1 mt-1 flex min-h-8 items-center gap-2 text-[13.5px] text-muted">
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
              <span className="truncate text-[13.5px] text-muted">
                {t("feed.showingCentral")}
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
              distanceMi={distanceFrom(position, top)}
            />
          )}

          {!isLoading && !error && allDemo && <DemoNotice />}

          {!isLoading && !error && sorted.length > 0 && (
            <p className="px-0 pb-1 pt-2 text-[13px] text-faint tnum">
              {activeLabel(activeCount, undefined, es)}
              {t("feed.last24")}
            </p>
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
                  <ShieldCheck
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
                    style={{ "--i": Math.min(idx, 10) } as React.CSSProperties}
                  >
                    {showHeader && (
                      <h2 className="-mx-4 bg-transparent px-4 pb-1 pt-5 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-faint">
                        {t(section)}
                      </h2>
                    )}
                    <IncidentRow incident={i} distanceMi={distanceFrom(position, i)} />
                  </div>
                );
              })
            )}
          </div>
          {!isLoading && !error && rest.length > limit && (
            <button
              onClick={() => setLimit((n) => n + 50)}
              className="press mt-2 flex min-h-12 w-full items-center justify-center rounded-2xl bg-surface text-[14.5px] font-semibold text-brand"
            >
              {t("common.showMore", { n: Math.min(50, rest.length - limit) })}
            </button>
          )}

          {!isLoading &&
            !error &&
            viewer?.plan === "free" &&
            sorted.length > 0 && (
              <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5">
                <p className="text-[13.5px] leading-snug text-muted">
                  {t("feed.freeNote")}
                </p>
                <ButtonLink
                  href="/upgrade"
                  variant="ghost"
                  size="sm"
                  transitionTypes={["nav-forward"]}
                  className="shrink-0 text-gold"
                >
                  {t("common.learnMore")}
                </ButtonLink>
              </div>
            )}

          <div className="mt-8">
            <EmergencyNote inline />
          </div>
        </div>
      </PullToRefresh>
    </main>
  );
}
