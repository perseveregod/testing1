"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  Footprints,
  Newspaper,
  PawPrint,
  Phone,
} from "lucide-react";
import { getCategory, FILTER_GROUPS } from "@/lib/categories";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { distanceFrom, useIncidents } from "@/lib/client/hooks";
import { formatRemaining, useClock, useSafeWalk } from "@/lib/client/safewalk";
import { RESOURCE_AREA, RESOURCES } from "@/lib/resources";
import { formatDistance } from "@/lib/geo";
import { timeAgo } from "@/lib/time";
import type { PublicIncident } from "@/lib/types";
import { useLocation } from "@/components/providers/LocationProvider";
import { DemoTag, isLive, LiveBadge } from "@/components/incident/Badges";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { EmergencyNote } from "@/components/EmergencyNote";
import { PageHeader } from "@/components/nav/PageHeader";
import { RowSkeleton } from "@/components/ui/States";
import { PullToRefresh } from "@/components/ui/PullToRefresh";

const SEV = { low: 0, moderate: 1, high: 2, critical: 3 } as const;

export function SafetyScreen() {
  const { position } = useLocation();
  const center = position ?? DEFAULT_CENTER;
  const { items, isLoading, mutate } = useIncidents({
    center,
    radiusMi: 10,
    sort: "newest",
    limit: 100,
  });
  const refresh = useCallback(() => mutate(), [mutate]);
  const walk = useSafeWalk()?.walk ?? null;
  const now = useClock(walk != null);

  const briefing = useMemo(() => {
    const active = items.filter((i) => i.status !== "resolved");
    const byGroup = FILTER_GROUPS.map((g) => ({
      ...g,
      count: active.filter((i) => getCategory(i.category).group === g.id)
        .length,
    })).filter((g) => g.count > 0);
    const top = [...items]
      .filter((i) => i.status !== "resolved" && i.category !== "missing_pet")
      .sort(
        (a, b) =>
          SEV[b.severity] - SEV[a.severity] ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 3);
    const pets = items.filter(
      (i) => i.category === "missing_pet" && i.status !== "resolved",
    );
    return {
      total: items.length,
      active: active.length,
      byGroup,
      top,
      pets,
      demo: items.some((i) => i.isDemo),
    };
  }, [items]);

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader title="Safety" large />
      <PullToRefresh onRefresh={refresh}>
        <div className="relative mx-auto max-w-lg px-4">
          {/* Safe Walk */}
          <Link
            href="/safety/walk"
            transitionTypes={["nav-forward"]}
            className="press relative block overflow-hidden rounded-[20px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]"
          >
            <div
              className="pointer-events-none absolute -right-12 -top-14 size-52 rounded-full bg-brand/30 blur-3xl"
              aria-hidden
            />
            <div className="relative flex items-center gap-3.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-ink">
                <Footprints className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[19px] font-extrabold tracking-[-0.025em]">
                  Safe Walk
                </p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
                  {walk
                    ? now > walk.endsAt
                      ? "Check-in missed. Tap to respond."
                      : `Walk in progress · ${formatRemaining(walk.endsAt - now)} left`
                    : "Walking alone? Set a check-in timer and let people you trust know."}
                </p>
              </div>
              <ChevronRight
                className="size-5 shrink-0 text-faint"
                aria-hidden
              />
            </div>
          </Link>

          {/* Briefing */}
          <section className="mt-8">
            <SectionTitle icon={<Newspaper className="size-4" aria-hidden />}>
              Today&apos;s briefing
            </SectionTitle>
            {isLoading ? (
              <RowSkeleton />
            ) : (
              <div className="rounded-[20px] bg-surface p-4">
                <p className="text-[15px] leading-relaxed">
                  <span className="font-bold tnum">{briefing.active}</span>{" "}
                  active {briefing.active === 1 ? "incident" : "incidents"}{" "}
                  within 10 miles in the last 24 hours
                  {briefing.demo && (
                    <>
                      {" "}
                      <DemoTag />
                    </>
                  )}
                </p>
                {briefing.byGroup.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {briefing.byGroup.map((g) => (
                      <span
                        key={g.id}
                        className="rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-semibold text-text/85 tnum"
                      >
                        {g.label} {g.count}
                      </span>
                    ))}
                  </div>
                )}
                {briefing.top.length > 0 && (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {briefing.top.map((i) => (
                      <BriefRow
                        key={i.id}
                        incident={i}
                        distanceMi={distanceFrom(position, i)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* Missing pets */}
          <section className="mt-8">
            <SectionTitle icon={<PawPrint className="size-4" aria-hidden />}>
              Missing pets nearby
            </SectionTitle>
            <div className="rounded-[20px] bg-surface p-1.5">
              {briefing.pets.length > 0 ? (
                <ul className="divide-y divide-line">
                  {briefing.pets.map((i) => (
                    <BriefRow
                      key={i.id}
                      incident={i}
                      distanceMi={distanceFrom(position, i)}
                      inset
                    />
                  ))}
                </ul>
              ) : (
                !isLoading && (
                  <p className="px-3 py-3 text-[14px] text-muted">
                    No missing pets posted nearby.
                  </p>
                )
              )}
              <Link
                href="/report"
                transitionTypes={["nav-forward"]}
                className="press mt-1 flex min-h-12 items-center justify-center rounded-[16px] bg-surface-2 text-[14.5px] font-semibold"
              >
                Report a lost or found pet
              </Link>
            </div>
            <p className="mt-2 px-1 text-[12.5px] leading-relaxed text-faint">
              For missing people, use the official bulletins below. Haven
              doesn&apos;t post missing-person reports from the public, to
              protect people who may not want to be found by someone else.
            </p>
          </section>

          {/* Resources */}
          <section className="mt-8">
            <SectionTitle icon={<Phone className="size-4" aria-hidden />}>
              Resources · {RESOURCE_AREA}
            </SectionTitle>
            <div className="space-y-4">
              {RESOURCES.map((g) => (
                <div key={g.id}>
                  <p className="mb-1.5 px-1 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-faint">
                    {g.title}
                  </p>
                  <ul className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface">
                    {g.items.map((r) => {
                      const external = r.href.startsWith("http");
                      return (
                        <li key={r.id}>
                          <a
                            href={r.href}
                            {...(external
                              ? { target: "_blank", rel: "noopener noreferrer" }
                              : {})}
                            className="flex min-h-[56px] items-center gap-3 px-4 py-3 active:bg-surface-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-semibold">
                                {r.title}
                              </p>
                              <p className="mt-0.5 text-[13px] leading-snug text-muted">
                                {r.detail}
                              </p>
                            </div>
                            {r.label ? (
                              <span className="shrink-0 text-[13.5px] font-semibold text-brand tnum">
                                {r.label}
                              </span>
                            ) : (
                              <ExternalLink
                                className="size-4 shrink-0 text-faint"
                                aria-label="Opens another site"
                              />
                            )}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-8">
            <EmergencyNote compact />
          </div>
        </div>
      </PullToRefresh>
    </main>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-2.5 flex items-center gap-2 px-1 text-[13px] font-semibold text-muted">
      {icon}
      {children}
    </h2>
  );
}

function BriefRow({
  incident,
  distanceMi,
  inset,
}: {
  incident: PublicIncident;
  distanceMi: number | null;
  inset?: boolean;
}) {
  const def = getCategory(incident.category);
  return (
    <li>
      <Link
        href={`/incidents/${incident.id}`}
        transitionTypes={["nav-forward"]}
        className={`flex items-center gap-3 py-3 active:opacity-70 ${inset ? "px-2.5" : ""}`}
      >
        <CategoryIcon category={incident.category} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold">
            {isLive(incident) && <LiveBadge />}
            <span className="truncate">{incident.title}</span>
          </p>
          <p className="truncate text-[12.5px] text-muted">
            <span style={{ color: def.color }}>{def.short}</span> ·{" "}
            {incident.approximateAddress}
            {distanceMi != null && (
              <span className="tnum"> · {formatDistance(distanceMi)}</span>
            )}
            <span className="tnum"> · {timeAgo(incident.createdAt)}</span>
          </p>
        </div>
      </Link>
    </li>
  );
}
