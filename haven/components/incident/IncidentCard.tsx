"use client";

import { memo } from "react";
import Link from "next/link";
import { formatDistance } from "@/lib/geo";
import { neighborhoodLabel, streetAddress } from "@/lib/houston";
import type { Key } from "@/lib/i18n";
import type { PublicIncident } from "@/lib/types";
import { isLive, LiveBadge, OriginBadge } from "./Badges";
import type { Affects } from "@/lib/client/affects";
import { useT } from "@/lib/client/lang";
import { CategoryIcon } from "./CategoryIcon";

/** Official dispatch feeds (city 911 data, weather) read as compact two-line rows. */
export function isDispatch(i: PublicIncident): boolean {
  return !i.isDemo && (i.source.kind === "open_data" || i.source.kind === "weather");
}

/**
 * A city dispatch as a compact row: what, where, when. No boilerplate text;
 * the full source note is one tap away on the incident page.
 */
export function DispatchRow({ incident, distanceMi }: { incident: PublicIncident; distanceMi: number | null }) {
  const { t, timeAgo, title } = useT();
  const ended = incident.status === "resolved";
  const live = isLive(incident);
  return (
    <Link
      href={`/incidents/${incident.id}`}
      prefetch={false}
      transitionTypes={["nav-forward"]}
      className="relative -mx-4 flex min-h-[60px] items-center gap-3 px-4 py-2.5 transition-colors active:bg-white/[0.03]"
    >
      <CategoryIcon category={incident.category} size="sm" muted={ended} />
      <div className="min-w-0 flex-1">
        <p className={`flex min-w-0 items-center gap-1.5 text-[15px] font-semibold tracking-[-0.01em] ${ended ? "text-muted" : ""}`}>
          {live && <LiveBadge />}
          <span className="truncate">{title(incident)}</span>
        </p>
        <p className="truncate text-[13px] text-muted">
          {ended && <span className="text-faint">{t("inc.ended")} · </span>}
          {streetAddress(incident.approximateAddress) || t("inc.approx")}
          {distanceMi != null && <span className="text-faint tnum"> · {formatDistance(distanceMi)}</span>}
        </p>
      </div>
      <span className="shrink-0 self-start pt-0.5 text-[12px] text-faint tnum">{timeAgo(incident.createdAt)}</span>
    </Link>
  );
}

/** Feed sections: what's still going on, then what has ended. Returns a dictionary key. */
export function timeSection(i: Pick<PublicIncident, "status" | "createdAt">, now = Date.now()): Key {
  if (i.status !== "resolved") return "feed.liveNow";
  const d = new Date(i.createdAt);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return "feed.earlierToday";
  const y = new Date(now - 86_400_000);
  if (d.toDateString() === y.toDateString()) return "feed.yesterday";
  return "feed.older";
}

/**
 * The same event can arrive twice (a dispatch feed and a neighbor report, or
 * an active record and its ended twin). Keep one per kind + title + block,
 * preferring the one still active, then the newest.
 */
export function foldDuplicates(items: PublicIncident[]): PublicIncident[] {
  const best = new Map<string, PublicIncident>();
  for (const i of items) {
    const key = `${i.category}|${i.title.trim().toLowerCase()}|${(i.approximateAddress || "").trim().toLowerCase()}`;
    const cur = best.get(key);
    if (!cur) {
      best.set(key, i);
      continue;
    }
    const curLive = cur.status !== "resolved";
    const live = i.status !== "resolved";
    if ((live && !curLive) || (live === curLive && i.createdAt > cur.createdAt)) best.set(key, i);
  }
  const keep = new Set([...best.values()].map((i) => i.id));
  return items.filter((i) => keep.has(i.id));
}

/**
 * One incident as a list row: glyph, title, place, and a two-line preview.
 * Memoized, and `affects` ("0.4 mi from Home") is worked out once by the
 * list, not per row: a row that subscribes to places and alert settings
 * itself costs four data subscriptions, times every row on screen.
 */
export const IncidentRow = memo(function IncidentRow({
  incident,
  distanceMi,
  affects,
}: {
  incident: PublicIncident;
  distanceMi: number | null;
  affects: Affects | null;
}) {
  const { t, timeAgo, title } = useT();
  const street = streetAddress(incident.approximateAddress);
  const hood = neighborhoodLabel({ lat: incident.latitude, lng: incident.longitude }, street);
  const ended = incident.status === "resolved";
  const live = isLive(incident);
  return (
    <Link
      href={`/incidents/${incident.id}`}
      prefetch={false}
      transitionTypes={["nav-forward"]}
      className="cv-row group relative -mx-4 flex gap-3 px-4 py-3.5 transition-colors active:bg-white/[0.03]"
    >
      {/* Live is said once, by the badge on the next line. */}
      <div className="pt-0.5">
        <CategoryIcon category={incident.category} muted={ended} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className={`min-w-0 flex-1 truncate text-[16px] font-semibold tracking-[-0.015em] ${ended ? "text-muted" : ""}`}>
            {title(incident)}
          </h3>
          <span className="shrink-0 text-[13px] text-faint tnum">{timeAgo(incident.createdAt)}</span>
        </div>
        {/* Where, then how far: two facts, not a string of them. */}
        <p className="mt-0.5 flex min-w-0 items-baseline gap-2 text-[13px] text-muted">
          {live && <LiveBadge />}
          <span className="min-w-0 truncate">
            {ended && <span className="text-faint">{t("inc.ended")} · </span>}
            {[hood, street].filter(Boolean).join(", ") || t("inc.approx")}
          </span>
          {affects ? (
            <span className="shrink-0 font-medium text-brand tnum">{t("near.from", { d: formatDistance(affects.distanceMi), place: affects.label })}</span>
          ) : (
            distanceMi != null && <span className="shrink-0 text-faint tnum">{formatDistance(distanceMi)}</span>
          )}
        </p>
        {incident.description && (
          <p className={`mt-1 line-clamp-2 text-[14px] leading-[1.45] ${ended ? "text-faint" : "text-text/70"}`}>
            {incident.description}
          </p>
        )}
        {(!incident.isDemo || incident.confirmationCount > 0) && (
          <div className="mt-1.5 flex items-center gap-2.5 text-[12px] text-faint">
            {!incident.isDemo && <OriginBadge incident={incident} />}
            {incident.confirmationCount > 0 && (
              <span className="tnum">
                {incident.confirmationCount === 1 ? t("inc.saw1") : t("inc.saw", { n: incident.confirmationCount })}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
});

const SEV_RANK = { low: 0, moderate: 1, high: 2, critical: 3 } as const;

/** The most serious incident that is live right now, if any. */
export function pickTopIncident(items: PublicIncident[]): PublicIncident | null {
  // Real, live and serious. Demo examples never get the "happening now" slot.
  const live = items.filter((i) => isLive(i) && SEV_RANK[i.severity] >= SEV_RANK.high);
  live.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.createdAt.localeCompare(a.createdAt));
  return live[0] ?? null;
}

/** Big "happening now" card pinned above the feed. */
export function TopIncidentCard({ incident, distanceMi }: { incident: PublicIncident; distanceMi: number | null }) {
  const { t, timeAgo, title, cat } = useT();
  const { def, short, label } = cat(incident.category);
  const street = streetAddress(incident.approximateAddress);
  const hood = neighborhoodLabel({ lat: incident.latitude, lng: incident.longitude }, street);
  const place = [hood, street].filter(Boolean).join(", ") || t("inc.approx");
  // A neighbor's report is titled with its category; don't say it twice.
  const name = title(incident).toLowerCase();
  const showKind = short.toLowerCase() !== name && label.toLowerCase() !== name;
  return (
    <Link
      href={`/incidents/${incident.id}`}
      prefetch={false}
      transitionTypes={["nav-forward"]}
      className="press relative mt-2 block overflow-hidden rounded-card bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]"
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold text-muted">
        <LiveBadge size="md" />
        <span className="min-w-0 truncate">{t("feed.happeningNow")}</span>
        <span className="ml-auto whitespace-nowrap pl-2 font-normal text-faint tnum">{timeAgo(incident.createdAt)}</span>
      </div>
      <div className="mt-3 flex gap-3.5">
        <CategoryIcon category={incident.category} size="lg" animated />
        <div className="min-w-0 flex-1">
          <h3 className="text-[20px] font-bold leading-[1.15] tracking-[-0.025em]">{title(incident)}</h3>
          <p className="mt-1 truncate text-[13px] text-muted">
            {showKind && (
              <>
                <span style={{ color: def.color }}>{short}</span>
                {" · "}
              </>
            )}
            {place}
            {distanceMi != null && <span className="text-faint tnum"> · {formatDistance(distanceMi)}</span>}
          </p>
        </div>
      </div>
      {incident.description && <p className="mt-3 line-clamp-2 text-[14px] leading-[1.45] text-text/80">{incident.description}</p>}
    </Link>
  );
}
