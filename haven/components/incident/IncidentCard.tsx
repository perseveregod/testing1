"use client";

import Link from "next/link";
import { formatDistance } from "@/lib/geo";
import { neighborhoodLabel } from "@/lib/houston";
import type { Key } from "@/lib/i18n";
import type { PublicIncident } from "@/lib/types";
import { isLive, LiveBadge, OriginBadge } from "./Badges";
import { useAffects } from "@/lib/client/affects";
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
          {incident.approximateAddress || t("inc.approx")}
          {distanceMi != null && <span className="text-faint tnum"> · {formatDistance(distanceMi)}</span>}
        </p>
      </div>
      <span className="shrink-0 self-start pt-0.5 text-[12.5px] text-faint tnum">{timeAgo(incident.createdAt)}</span>
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

/** One incident as a list row: glyph, title, place, and a two-line preview. */
export function IncidentRow({ incident, distanceMi }: { incident: PublicIncident; distanceMi: number | null }) {
  const { t, timeAgo, title, cat } = useT();
  const { def, short } = cat(incident.category);
  const hood = neighborhoodLabel({ lat: incident.latitude, lng: incident.longitude }, incident.approximateAddress);
  const affects = useAffects()(incident);
  const ended = incident.status === "resolved";
  const active = incident.status === "active";
  const live = isLive(incident);
  return (
    <Link
      href={`/incidents/${incident.id}`}
      prefetch={false}
      transitionTypes={["nav-forward"]}
      className="group relative -mx-4 flex gap-3.5 px-4 py-4 transition-colors active:bg-white/[0.03]"
    >
      {/* Category-colored rail marks incidents that are still going on. */}
      {!ended && (
        <span
          className="absolute bottom-4 left-0 top-4 w-[3px] rounded-r-full"
          style={{ background: def.color, opacity: live ? 1 : 0.45 }}
          aria-hidden
        />
      )}
      <div className="relative pt-0.5">
        <CategoryIcon category={incident.category} muted={ended} />
        {active && incident.severity !== "low" && (
          <span className="absolute -right-0.5 top-0 size-2.5 rounded-full bg-danger ring-[2.5px] ring-bg" aria-label={t("inc.active")} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className={`min-w-0 flex-1 truncate text-[16.5px] font-bold tracking-[-0.02em] ${ended ? "text-muted" : ""}`}>
            {title(incident)}
          </h3>
          <span className="shrink-0 text-[13px] text-faint tnum">{timeAgo(incident.createdAt)}</span>
        </div>
        {/* WHERE and WHAT KIND, then live / ended state, on one predictable line. */}
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13.5px] text-muted">
          {live && <LiveBadge />}
          {ended && <span className="shrink-0 text-faint">{t("inc.ended")} ·</span>}
          <span className="truncate">
            <span style={{ color: ended ? undefined : def.color }}>{short}</span>
            <span className="text-faint"> · </span>
            {hood && <>{hood}<span className="text-faint"> · </span></>}
            {incident.approximateAddress || t("inc.approx")}
          </span>
          {affects ? (
            <span className="shrink-0 font-semibold text-brand tnum">· {t("near.from", { d: formatDistance(affects.distanceMi), place: affects.label })}</span>
          ) : (
            distanceMi != null && <span className="shrink-0 text-faint tnum">· {formatDistance(distanceMi)}</span>
          )}
        </p>
        {incident.description && (
          <p className={`mt-1.5 line-clamp-2 text-[14.5px] leading-[1.45] ${ended ? "text-faint" : "text-text/75"}`}>
            {incident.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2.5 text-[12.5px] text-faint">
          {/* Demo rows are covered by the one banner above the list. */}
          {!incident.isDemo && <OriginBadge incident={incident} />}
          {incident.confirmationCount > 0 && (
            <span className="tnum">
              {incident.confirmationCount === 1 ? t("inc.saw1") : t("inc.saw", { n: incident.confirmationCount })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

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
  const { def, short } = cat(incident.category);
  return (
    <Link
      href={`/incidents/${incident.id}`}
      prefetch={false}
      transitionTypes={["nav-forward"]}
      className="press relative mt-2 block overflow-hidden rounded-card bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(55% 80% at 95% 0%, color-mix(in srgb, ${def.color} 22%, transparent), transparent 70%)` }}
        aria-hidden
      />
      <div className="relative flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted">
        <LiveBadge size="md" />
        <span>{t("feed.happeningNow")}</span>
      </div>
      <div className="relative mt-3 flex gap-3.5">
        <CategoryIcon category={incident.category} size="lg" animated />
        <div className="min-w-0 flex-1">
          <h3 className="text-[21px] font-extrabold leading-[1.15] tracking-[-0.03em]">{title(incident)}</h3>
          <p className="mt-1 truncate text-[13.5px] text-muted">
            <span style={{ color: def.color }}>{short}</span>
            <span className="text-faint"> · </span>
            {incident.approximateAddress || t("inc.approx")}
            {distanceMi != null && <span className="text-faint tnum"> · {formatDistance(distanceMi)}</span>}
            <span className="text-faint tnum"> · {timeAgo(incident.createdAt)}</span>
          </p>
        </div>
      </div>
      {incident.description && <p className="relative mt-3 line-clamp-2 text-[14.5px] leading-[1.45] text-text/80">{incident.description}</p>}
    </Link>
  );
}
