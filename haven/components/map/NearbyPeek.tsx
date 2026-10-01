"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronUp } from "lucide-react";
import { distanceFrom, NEAR_RADIUS_MI } from "@/lib/client/hooks";
import { useAffects } from "@/lib/client/affects";
import { useT } from "@/lib/client/lang";
import { formatDistance, type LatLng } from "@/lib/geo";
import type { Lang } from "@/lib/storm";
import type { PublicIncident } from "@/lib/types";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { isLive } from "@/components/incident/Badges";

/**
 * The map's bottom sheet, docked above the tab bar. Collapsed it is one row:
 * the shared count and where it applies. Pulled up, the nearest incidents.
 */
export function NearbyPeek({
  items,
  activeCount,
  loading,
  error,
  onRetry,
  allDemo,
  position,
  now,
  onPick,
  onLocate,
  storm,
}: {
  items: PublicIncident[];
  activeCount: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  allDemo: boolean;
  position: LatLng | null;
  now: number;
  onPick: (id: string) => void;
  /** When set, the sheet offers "Locate me" instead of naming the default area. */
  onLocate?: (() => void) | null;
  /** Storm Mode: the count is storm reports from the last 6 hours. */
  storm?: { lang: Lang } | null;
}) {
  const [open, setOpen] = useState(false);
  const affectsOf = useAffects();
  const { t, timeAgo, title: titleOf } = useT();
  const active = items.filter((i) => i.status !== "resolved" && i.category !== "missing_pet");
  const sorted = position
    ? [...active].sort((a, b) => (distanceFrom(position, a) ?? 0) - (distanceFrom(position, b) ?? 0))
    : [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = open ? sorted.slice(0, 5) : [];

  if (loading && items.length === 0) return null;

  const title = storm
    ? activeCount === 0
      ? t("near.stormNone")
      : activeCount === 1
        ? t("near.stormCount1")
        : t("near.stormCount", { n: activeCount })
    : activeCount === 1
      ? t("near.active1")
      : t("near.active", { n: activeCount });
  const where = storm
    ? activeCount === 0
      ? t("near.stormHint")
      : t("near.stormWindow")
    : position
      ? t("near.withinYou", { n: NEAR_RADIUS_MI })
      : t("near.withinCenter", { n: NEAR_RADIUS_MI });

  return (
    <section aria-label={title} className="panel pointer-events-auto overflow-hidden rounded-[22px]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={Boolean(error) || active.length === 0}
        className="relative flex min-h-[60px] w-full items-center gap-3 px-4 pb-2.5 pt-3.5 text-left"
      >
        <span className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-text/20" aria-hidden />
        {error ? (
          <span className="text-[14px] text-danger" onClick={onRetry} role="button">
            {t("near.loadError")}
          </span>
        ) : (
          <>
            <span
              className={`size-2.5 shrink-0 rounded-full ${activeCount > 0 ? (storm ? "bg-[#ffc233]" : "bg-live") : "bg-ok"}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[16px] font-semibold leading-tight tracking-[-0.01em] tnum">
                {title}
                {allDemo && (
                  <span className="rounded-[4px] bg-text/[0.08] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                    {t("common.demo")}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[13px] leading-tight text-muted">
                {where}
                {!storm && onLocate && !position && (
                  <>
                    {" · "}
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLocate();
                      }}
                      className="font-semibold text-brand"
                    >
                      {t("common.locateMe")}
                    </span>
                  </>
                )}
              </span>
            </span>
            {active.length > 0 && (
              <ChevronUp className={`size-5 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
            )}
          </>
        )}
      </button>
      {open && (
        <>
          <ul className="border-t border-line px-2 pb-1 pt-1">
            {rows.map((i) => {
              const d = distanceFrom(position, i);
              const live = isLive(i, now);
              const a = affectsOf(i);
              return (
                <li key={i.id}>
                  <button
                    onClick={() => onPick(i.id)}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left active:bg-text/[0.06]"
                  >
                    <CategoryIcon category={i.category} size="sm" animated={live} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold tracking-[-0.01em]">{titleOf(i)}</span>
                      <span className="block truncate text-[12.5px] text-muted tnum">
                        {live && <span className="mr-1.5 font-bold uppercase text-live">{t("common.live")}</span>}
                        {a ? <span className="font-semibold text-brand">{t("near.from", { d: formatDistance(a.distanceMi), place: a.label })} · </span> : d != null && `${formatDistance(d)} · `}
                        {now > 0 ? timeAgo(i.createdAt, now) : ""}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {!storm && (
            <Link
              href="/feed"
              transitionTypes={["tab"]}
              className="flex min-h-11 items-center justify-center border-t border-line text-[13.5px] font-semibold text-brand"
            >
              {t("near.seeAll")}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
