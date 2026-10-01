"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  Footprints,
  PawPrint,
  ShieldCheck,
} from "lucide-react";
import { getCategory, FILTER_GROUPS } from "@/lib/categories";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { distanceFrom, NEAR_RADIUS_MI, useNearYou, type InitialIncidents } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { neighborhoodFor } from "@/lib/houston";
import { formatRemaining, useClock, useSafeWalk } from "@/lib/client/safewalk";
import { RESOURCE_AREA, RESOURCES } from "@/lib/resources";
import { formatDistance } from "@/lib/geo";
import type { PublicIncident } from "@/lib/types";
import { useLocation } from "@/components/providers/LocationProvider";
import { isLive, LiveBadge } from "@/components/incident/Badges";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { DemoNotice } from "@/components/incident/DemoNotice";
import { EmergencyNote } from "@/components/EmergencyNote";
import { CampusCard } from "@/components/safety/CampusCard";
import { PageHeader } from "@/components/nav/PageHeader";
import { RowSkeleton } from "@/components/ui/States";
import { PullToRefresh } from "@/components/ui/PullToRefresh";

const SEV = { low: 0, moderate: 1, high: 2, critical: 3 } as const;

/**
 * Safety tab. Order follows what someone opening it most likely needs:
 * 1. act now (Safe Walk, emergency number), 2. know what is going on nearby,
 * 3. look something up (official resources).
 */
export function SafetyScreen({ initial }: { initial?: InitialIncidents | null }) {
  const { position } = useLocation();
  const center = position ?? DEFAULT_CENTER;
  const { items, isLoading, mutate } = useNearYou(center, initial);
  const refresh = useCallback(() => mutate(), [mutate]);
  const walk = useSafeWalk()?.walk ?? null;
  const now = useClock(walk != null);
  const overdue = walk != null && now > 0 && now > walk.endsAt;
  const { t, es } = useT();
  const hood = position ? neighborhoodFor(position) : null;

  const briefing = useMemo(() => {
    // Same number as the Map and Feed: everything still active, pets included.
    const active = items.filter((i) => i.status !== "resolved");
    const incidents = active.filter((i) => i.category !== "missing_pet");
    const byGroup = FILTER_GROUPS.map((g) => ({
      ...g,
      count: active.filter((i) => getCategory(i.category).group === g.id).length,
    }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count);
    const top = [...incidents]
      .sort((a, b) => SEV[b.severity] - SEV[a.severity] || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);
    const pets = items.filter((i) => i.category === "missing_pet" && i.status !== "resolved");
    return {
      active: active.length,
      byGroup,
      top,
      pets,
      allDemo: items.length > 0 && items.every((i) => i.isDemo),
    };
  }, [items]);

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader title={t("safety.title")} large />
      <PullToRefresh onRefresh={refresh}>
        <div className="relative mx-auto max-w-lg px-4">
          {/* 1. Act now */}
          <Link
            href="/safety/walk"
            transitionTypes={["nav-forward"]}
            className={`press relative block overflow-hidden rounded-card p-4 shadow-[inset_0_0_0_1px_var(--line)] ${
              overdue ? "bg-live text-white" : "bg-surface"
            }`}
          >
            {!overdue && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(60% 90% at 92% 0%, rgba(61,139,255,0.22), rgba(61,139,255,0) 70%)" }}
                aria-hidden
              />
            )}
            <div className="relative flex items-center gap-3.5">
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-control ${
                  overdue ? "bg-white/20 text-white" : "bg-brand text-brand-ink"
                }`}
              >
                <Footprints className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[18px] font-bold tracking-[-0.02em]">
                  {walk ? (overdue ? t("safety.walkMissed") : t("safety.walkOn")) : t("safety.walk")}
                </p>
                <p className={`mt-0.5 text-[13.5px] leading-snug ${overdue ? "text-white/90" : "text-muted"}`}>
                  {walk
                    ? overdue
                      ? t("safety.walkMissedBody")
                      : t("safety.walkUntil", { t: formatRemaining(walk.endsAt - now) })
                    : t("safety.walkBody")}
                </p>
              </div>
              <ChevronRight className={`size-5 shrink-0 ${overdue ? "text-white/80" : "text-faint"}`} aria-hidden />
            </div>
          </Link>

          <div className="mt-3">
            <CampusCard />
          </div>

          <div className="mt-1">
            <EmergencyNote inline />
          </div>

          {/* 2. What is going on nearby */}
          <section className="mt-8" aria-labelledby="briefing">
            <div className="mb-2.5 flex items-baseline justify-between px-1">
              <h2 id="briefing" className="text-[13px] font-semibold text-muted">
                {hood ? t("near.hoodNow", { hood }) : t("safety.nearby")}
              </h2>
              <span className="text-[12.5px] text-faint tnum">{t("safety.window", { n: NEAR_RADIUS_MI })}</span>
            </div>
            {briefing.allDemo && <DemoNotice className="mb-2.5 mt-0" />}
            {isLoading ? (
              <div className="rounded-card bg-surface px-4">
                <RowSkeleton />
              </div>
            ) : briefing.active === 0 ? (
              <div className="flex items-center gap-3.5 rounded-card bg-surface p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok">
                  <ShieldCheck className="size-6" aria-hidden />
                </span>
                <div>
                  <p className="text-[15.5px] font-semibold">{t("safety.quiet")}</p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{t("safety.quietBody")}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-card bg-surface px-4 pt-4">
                <p className="text-[15px] leading-snug">
                  <span className="text-[22px] font-bold tracking-[-0.02em] tnum">{briefing.active}</span>{" "}
                  <span className="text-muted">{t("safety.activeWithin", { n: NEAR_RADIUS_MI })}</span>
                </p>
                {briefing.byGroup.length > 0 && (
                  <p className="mt-1.5 text-[13px] text-muted tnum">
                    {briefing.byGroup.map((g) => `${es ? g.labelEs : g.label} ${g.count}`).join(" · ")}
                  </p>
                )}
                {briefing.top.length > 0 && (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {briefing.top.map((i) => (
                      <BriefRow key={i.id} incident={i} distanceMi={distanceFrom(position, i)} />
                    ))}
                  </ul>
                )}
                <Link
                  href="/feed"
                  transitionTypes={["tab"]}
                  className="-mx-4 flex min-h-12 items-center justify-center border-t border-line text-[14px] font-semibold text-brand active:opacity-60"
                >
                  {t("safety.seeAll")}
                </Link>
              </div>
            )}
          </section>

          {/* Missing pets: only takes space when there is something to show. */}
          <section className="mt-8" aria-labelledby="pets">
            <div className="mb-2.5 flex items-baseline justify-between px-1">
              <h2 id="pets" className="text-[13px] font-semibold text-muted">
                {t("safety.pets")}
              </h2>
              <Link href="/report" transitionTypes={["nav-forward"]} className="text-[13px] font-medium text-brand">
                {t("safety.postPet")}
              </Link>
            </div>
            {briefing.pets.length > 0 ? (
              <ul className="divide-y divide-line rounded-card bg-surface px-4">
                {briefing.pets.map((i) => (
                  <BriefRow key={i.id} incident={i} distanceMi={distanceFrom(position, i)} />
                ))}
              </ul>
            ) : (
              !isLoading && (
                <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3">
                  <PawPrint className="size-5 shrink-0 text-faint" aria-hidden />
                  <p className="text-[14px] leading-snug text-muted">{t("safety.noPets")}</p>
                </div>
              )
            )}
          </section>

          {/* 3. Look something up */}
          <section className="mt-8" aria-labelledby="resources">
            <div className="mb-2.5 flex items-baseline justify-between px-1">
              <h2 id="resources" className="text-[13px] font-semibold text-muted">
                {t("safety.resources")}
              </h2>
              <span className="text-[12.5px] text-faint">{RESOURCE_AREA}</span>
            </div>
            <div className="overflow-hidden rounded-card bg-surface">
              {RESOURCES.map((g, gi) => (
                <div key={g.id} className={gi > 0 ? "border-t-4 border-bg/60" : ""}>
                  <p className="px-4 pb-1 pt-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">
                    {g.title}
                  </p>
                  <ul className="divide-y divide-line">
                    {g.items.map((r) => {
                      const external = r.href.startsWith("http");
                      return (
                        <li key={r.id}>
                          <a
                            href={r.href}
                            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                            className="flex min-h-[52px] items-center gap-3 px-4 py-2.5 active:bg-surface-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-medium tracking-[-0.01em]">{r.title}</p>
                              <p className="mt-0.5 text-[13px] leading-snug text-muted">{r.detail}</p>
                            </div>
                            {r.label ? (
                              <span className="shrink-0 text-[13.5px] font-semibold text-brand tnum">{r.label}</span>
                            ) : (
                              <ExternalLink className="size-4 shrink-0 text-faint" aria-label={t("common.opensSite")} />
                            )}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-2 px-1 text-[12.5px] leading-relaxed text-faint">{t("safety.resourcesNote")}</p>
          </section>
        </div>
      </PullToRefresh>
    </main>
  );
}

function BriefRow({ incident, distanceMi }: { incident: PublicIncident; distanceMi: number | null }) {
  const { timeAgo, title, cat } = useT();
  const { def, short } = cat(incident.category);
  return (
    <li>
      <Link
        href={`/incidents/${incident.id}`}
        prefetch={false}
        transitionTypes={["nav-forward"]}
        className="flex items-center gap-3 py-3 active:opacity-70"
      >
        <CategoryIcon category={incident.category} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{title(incident)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
            {isLive(incident) && <LiveBadge />}
            <span className="truncate">
              <span style={{ color: def.color }}>{short}</span> · {incident.approximateAddress}
              {distanceMi != null && <span className="tnum"> · {formatDistance(distanceMi)}</span>}
              <span className="tnum"> · {timeAgo(incident.createdAt)}</span>
            </span>
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
      </Link>
    </li>
  );
}
