"use client";

import { useMemo, useState } from "react";
import { MapPinned, Navigation, ShieldCheck } from "lucide-react";
import { categoriesInGroup, type FilterGroup } from "@/lib/categories";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { distanceFrom, useIncidents, useViewer } from "@/lib/client/hooks";
import { errorMessage } from "@/lib/client/api";
import { useLocation } from "@/components/providers/LocationProvider";
import { IncidentRow, pickTopIncident, TopIncidentCard } from "@/components/incident/IncidentCard";
import { EmergencyNote } from "@/components/EmergencyNote";
import { PageHeader } from "@/components/nav/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Controls";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/ui/States";

type FeedFilter = "nearby" | "newest" | FilterGroup;

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "nearby", label: "Nearby" },
  { id: "newest", label: "Newest" },
  { id: "police", label: "Police" },
  { id: "fire", label: "Fire" },
  { id: "medical", label: "Medical" },
  { id: "traffic", label: "Traffic" },
  { id: "weather", label: "Weather" },
  { id: "other", label: "Other" },
];

const FEED_RADIUS_MI = 10;

export function FeedScreen() {
  const { position, status, request } = useLocation();
  const { viewer } = useViewer();
  const [filter, setFilter] = useState<FeedFilter>("nearby");
  const center = position ?? DEFAULT_CENTER;
  const isGroup = filter !== "nearby" && filter !== "newest";

  const { items, data, error, isLoading, mutate } = useIncidents({
    center,
    radiusMi: filter === "nearby" ? 5 : FEED_RADIUS_MI,
    sort: filter === "nearby" && position ? "distance" : "newest",
    categories: isGroup ? categoriesInGroup(filter) : undefined,
    limit: 100,
  });

  const sorted = useMemo(() => {
    // Ended incidents sink below active ones in "Nearby".
    if (filter !== "nearby") return items;
    return [...items].sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved"));
  }, [items, filter]);

  const activeCount = items.filter((i) => i.status !== "resolved").length;
  const top = useMemo(() => (isGroup ? null : pickTopIncident(items)), [items, isGroup]);
  const rest = useMemo(() => (top ? sorted.filter((i) => i.id !== top.id) : sorted), [sorted, top]);

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader
        title="Near you"
        large
        sub={
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3 pt-1" role="toolbar" aria-label="Feed filters">
            {FILTERS.map((f) => (
              <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        }
      />
      <div className="mx-auto max-w-lg px-4">
        {!position && (
          <button
            onClick={request}
            disabled={status === "denied" || status === "unavailable"}
            className="press mb-2 mt-1 flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left disabled:opacity-70"
          >
            <Navigation className="size-[18px] shrink-0 text-brand" aria-hidden />
            <span className="text-[14px] leading-snug text-muted">
              {status === "denied"
                ? "Location is off, so this shows the default area. Enable it in browser settings for distances."
                : "Showing the default area. Tap to use your location."}
            </span>
          </button>
        )}

        {!isLoading && !error && top && <TopIncidentCard incident={top} distanceMi={distanceFrom(position, top)} />}

        {!isLoading && !error && sorted.length > 0 && (
          <p className="px-0 pb-1 pt-2 text-[13px] text-faint tnum">
            {activeCount} active · last {data?.sinceHours === 24 ? "24 hours" : `${Math.round((data?.sinceHours ?? 24) / 24)} days`}
          </p>
        )}

        <div className="stagger divide-y divide-line">
          {isLoading ? (
            Array.from({ length: 5 }, (_, i) => <RowSkeleton key={i} />)
          ) : error ? (
            <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="size-9" strokeWidth={1.5} aria-hidden />}
              title="All quiet nearby"
              body={isGroup ? "No incidents in this category in the last 24 hours." : "Nothing has been reported around here in the last 24 hours."}
              action={
                <ButtonLink href="/" variant="secondary" transitionTypes={["tab"]}>
                  <MapPinned className="size-4" aria-hidden /> Explore the map
                </ButtonLink>
              }
            />
          ) : (
            rest.map((i, idx) => (
              <div key={i.id} style={{ "--i": Math.min(idx, 10) } as React.CSSProperties}>
                <IncidentRow incident={i} distanceMi={distanceFrom(position, i)} />
              </div>
            ))
          )}
        </div>

        {!isLoading && !error && data && viewer?.plan === "free" && sorted.length > 0 && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5">
            <p className="text-[13.5px] leading-snug text-muted">Showing 24 hours. Lifetime keeps 90 days.</p>
            <ButtonLink href="/upgrade" variant="ghost" size="sm" transitionTypes={["nav-forward"]} className="shrink-0 text-gold">
              Learn more
            </ButtonLink>
          </div>
        )}

        <div className="mt-8">
          <EmergencyNote compact />
        </div>
      </div>
    </main>
  );
}
