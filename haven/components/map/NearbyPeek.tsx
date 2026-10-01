"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronUp } from "lucide-react";
import { activeLabel, distanceFrom } from "@/lib/client/hooks";
import { formatDistance, type LatLng } from "@/lib/geo";
import { timeAgo } from "@/lib/time";
import type { PublicIncident } from "@/lib/types";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { isLive } from "@/components/incident/Badges";
import { Spinner } from "@/components/ui/States";

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
}) {
  const [open, setOpen] = useState(false);
  const active = items.filter((i) => i.status !== "resolved" && i.category !== "missing_pet");
  const sorted = position
    ? [...active].sort((a, b) => (distanceFrom(position, a) ?? 0) - (distanceFrom(position, b) ?? 0))
    : [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = open ? sorted.slice(0, 5) : [];

  return (
    <section aria-label="Right now near you" className={`pointer-events-auto overflow-hidden rounded-[22px] ${open ? "glass-sheet" : "glass"}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={loading || Boolean(error) || active.length === 0}
        className="relative flex min-h-[56px] w-full items-center gap-2 px-4 pb-2 pt-3.5 text-left"
      >
        <span className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-white/25" aria-hidden />
        {loading ? (
          <>
            <Spinner className="size-3.5" />
            <span className="text-[13.5px] text-muted">Loading incidents</span>
          </>
        ) : error ? (
          <span className="text-[13.5px] text-danger" onClick={onRetry} role="button">
            Couldn&apos;t load · Retry
          </span>
        ) : (
          <>
            <span className={`size-2 rounded-full ${activeCount > 0 ? "bg-live" : "bg-ok"}`} aria-hidden />
            <span className="shrink-0 whitespace-nowrap text-[15px] font-bold tracking-[-0.01em] tnum">{activeLabel(activeCount)}</span>
            <span className="min-w-0 truncate text-[13px] text-muted">{position ? "near you" : "central Houston"}</span>
            {allDemo && (
              <span className="shrink-0 rounded-[4px] bg-white/[0.1] px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.06em] text-text/70">
                Demo
              </span>
            )}
            {active.length > 0 && (
              <ChevronUp className={`ml-auto size-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
            )}
          </>
        )}
      </button>
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
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left active:bg-white/[0.06]"
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
            className="flex min-h-11 items-center justify-center border-t border-white/[0.08] text-[13.5px] font-semibold text-brand"
          >
            See everything nearby
          </Link>
        </>
      )}
    </section>
  );
}
