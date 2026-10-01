"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronUp } from "lucide-react";
import { distanceFrom, NEAR_RADIUS_MI } from "@/lib/client/hooks";
import { formatDistance, type LatLng } from "@/lib/geo";
import { timeAgo } from "@/lib/time";
import type { PublicIncident } from "@/lib/types";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { isLive } from "@/components/incident/Badges";
import type { Lang } from "@/lib/storm";

/**
 * The map's bottom bar: the one shared count ("7 active · 5 mi") and, pulled
 * up, the nearest active incidents. Collapsed it is one slim row, so the map
 * stays the point of the screen.
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
  /** When set, the bar offers "Use my location" instead of naming the default area. */
  onLocate?: (() => void) | null;
  /** Storm Mode: the number is storm reports, and a Report button sits on the right. */
  storm?: { lang: Lang } | null;
}) {
  const [open, setOpen] = useState(false);
  const active = items.filter((i) => i.status !== "resolved" && i.category !== "missing_pet");
  const sorted = position
    ? [...active].sort((a, b) => (distanceFrom(position, a) ?? 0) - (distanceFrom(position, b) ?? 0))
    : [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = open ? sorted.slice(0, 5) : [];

  const n = String(activeCount).padStart(2, "0");
  const title = storm ? (storm.lang === "es" ? "Reportes de tormenta" : "Storm reports") : "Nearby active incidents";
  const sub = storm
    ? activeCount === 0
      ? storm.lang === "es"
        ? "Sea el primero en reportar luz, inundación o un lugar abierto"
        : "Be the first to report power, flooding or an open place"
      : storm.lang === "es"
        ? "Últimas 6 h · cerca de usted"
        : "Last 6h · near you"
    : `Within ${NEAR_RADIUS_MI} mi`;
  return (
    <section aria-label={title} className={`pointer-events-auto ${open ? "glass-sheet overflow-hidden rounded-[22px]" : ""}`}>
      <div className={`flex items-end gap-3 ${open ? "px-4 pb-2 pt-4" : "px-1 pb-1"}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={loading || Boolean(error) || active.length === 0}
        className="flex min-w-0 flex-1 items-end gap-3 text-left"
      >
        {loading ? null : error ? (
          <span className="pb-2 text-[13.5px] text-danger" onClick={onRetry} role="button">
            Couldn&apos;t load · Retry
          </span>
        ) : (
          <>
            <span
              className={`text-[52px] font-extrabold leading-[0.9] tracking-[-0.04em] tnum ${activeCount > 0 ? (storm ? "text-[#FFC233]" : "text-live") : "text-text"}`}
              style={{ textShadow: "0 2px 12px var(--halo)" }}
            >
              {n}
            </span>
            <span className="min-w-0 pb-0.5">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold leading-tight text-text" style={{ textShadow: "0 1px 6px var(--halo)" }}>
                {title}
                {active.length > 0 && (
                  <ChevronUp className={`size-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                )}
              </span>
              <span className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] leading-tight text-muted" style={{ textShadow: "0 1px 6px var(--halo)" }}>
                {sub}
                {storm ? null : onLocate && !position ? (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLocate();
                    }}
                    className="font-semibold text-brand"
                  >
                    · Locate me
                  </span>
                ) : (
                  <span>· {position ? "of you" : "of central Houston"}</span>
                )}
                {allDemo && <span className="rounded-[3px] bg-text/[0.1] px-1 text-[9.5px] font-bold uppercase tracking-wide text-text/70">Demo</span>}
              </span>
            </span>
          </>
        )}
      </button>
      </div>
      {open && (
        <>
          <ul className="px-2 pb-1">
            {rows.map((i) => {
              const d = distanceFrom(position, i);
              const live = isLive(i, now);
              return (
                <li key={i.id}>
                  <button
                    onClick={() => onPick(i.id)}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left active:bg-text/[0.06]"
                  >
                    <CategoryIcon category={i.category} size="sm" animated={live} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold tracking-[-0.01em]">{i.title}</span>
                      <span className="block truncate text-[12.5px] text-muted tnum">
                        {live && <span className="mr-1.5 font-bold text-live">LIVE</span>}
                        {d != null && `${formatDistance(d)} · `}
                        {now > 0 ? timeAgo(i.createdAt, now) : ""}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            href="/feed"
            transitionTypes={["tab"]}
            className="flex min-h-11 items-center justify-center border-t border-line text-[13.5px] font-semibold text-brand"
          >
            See everything nearby
          </Link>
        </>
      )}
    </section>
  );
}
