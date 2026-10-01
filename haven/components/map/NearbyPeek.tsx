"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronUp } from "lucide-react";
import { distanceFrom } from "@/lib/client/hooks";
import { formatDistance, type LatLng } from "@/lib/geo";
import { timeAgo } from "@/lib/time";
import type { PublicIncident } from "@/lib/types";
import { getCategory } from "@/lib/categories";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { isLive } from "@/components/incident/Badges";

/**
 * "Right now near you": peeks above the tab bar with the 2–3 nearest active
 * incidents. Tap a row to select its pin; pull up for a few more.
 */
export function NearbyPeek({
  items,
  position,
  now,
  onPick,
}: {
  items: PublicIncident[];
  position: LatLng | null;
  now: number;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = items.filter((i) => i.status !== "resolved" && i.category !== "missing_pet");
  const sorted = position
    ? [...active].sort((a, b) => (distanceFrom(position, a) ?? 0) - (distanceFrom(position, b) ?? 0))
    : [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = sorted.slice(0, open ? 6 : 3);
  if (active.length === 0) return null;

  return (
    <section
      aria-label="Right now near you"
      className="glass-sheet pointer-events-auto haven-rise overflow-hidden rounded-[22px]"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 pb-1 pt-2.5 text-left"
      >
        <span className="mx-auto mb-1 block h-1 w-9 rounded-full bg-white/25 absolute left-1/2 top-1.5 -translate-x-1/2" aria-hidden />
        <span className="text-[13px] font-semibold text-muted">{position ? "Right now near you" : "Right now in Houston"}</span>
        <span className="ml-auto text-[12.5px] text-faint tnum">{active.length} active</span>
        <ChevronUp className={`size-4 text-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <ul className="px-2 pb-2">
        {rows.map((i) => {
          const def = getCategory(i.category);
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
                    {i.severity === "critical" || i.severity === "high" ? ` · ${def.label}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {open && (
        <Link
          href="/feed"
          transitionTypes={["tab"]}
          className="flex min-h-11 items-center justify-center border-t border-white/[0.08] text-[13.5px] font-semibold text-brand"
        >
          See everything nearby
        </Link>
      )}
    </section>
  );
}
