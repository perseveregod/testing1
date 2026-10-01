import Link from "next/link";
import { getCategory } from "@/lib/categories";
import { formatDistance } from "@/lib/geo";
import { timeAgo } from "@/lib/time";
import type { PublicIncident } from "@/lib/types";
import { DemoTag, isLive, LiveBadge, OriginBadge } from "./Badges";
import { CategoryIcon } from "./CategoryIcon";

/** One incident as a list row: glyph, title, place, and a two-line preview. */
export function IncidentRow({ incident, distanceMi }: { incident: PublicIncident; distanceMi: number | null }) {
  const def = getCategory(incident.category);
  const ended = incident.status === "resolved";
  const active = incident.status === "active";
  const live = isLive(incident);
  return (
    <Link
      href={`/incidents/${incident.id}`}
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
          <span className="absolute -right-0.5 top-0 size-2.5 rounded-full bg-danger ring-[2.5px] ring-bg" aria-label="Active" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className={`flex min-w-0 flex-1 items-center gap-2 text-[16.5px] font-bold tracking-[-0.02em] ${ended ? "text-muted" : ""}`}>
            {live && <LiveBadge />}
            <span className="truncate">{incident.title}</span>
          </h3>
          <span className="shrink-0 text-[13px] text-faint tnum">{timeAgo(incident.createdAt)}</span>
        </div>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13.5px] text-muted">
          <span className="truncate">
            <span style={{ color: ended ? undefined : def.color }}>{def.short}</span>
            <span className="text-faint"> · </span>
            {incident.approximateAddress || "Approximate location"}
          </span>
          {distanceMi != null && <span className="shrink-0 text-faint tnum">· {formatDistance(distanceMi)}</span>}
        </p>
        {incident.description && (
          <p className={`mt-1.5 line-clamp-2 text-[14.5px] leading-[1.45] ${ended ? "text-faint" : "text-text/75"}`}>
            {incident.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2.5 text-[12.5px] text-faint">
          <OriginBadge incident={incident} />
          {(ended || incident.confirmationCount > 0) && (
            <>
            {ended && <span>Ended</span>}
            {incident.confirmationCount > 0 && <span className="tnum">
                {incident.confirmationCount} {incident.confirmationCount === 1 ? "person" : "people"} saw this
              </span>}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

const SEV_RANK = { low: 0, moderate: 1, high: 2, critical: 3 } as const;

/** The most serious incident that is live right now, if any. */
export function pickTopIncident(items: PublicIncident[]): PublicIncident | null {
  const live = items.filter((i) => isLive(i) && SEV_RANK[i.severity] >= SEV_RANK.high);
  live.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.createdAt.localeCompare(a.createdAt));
  return live[0] ?? null;
}

/** Big "happening now" card pinned above the feed. */
export function TopIncidentCard({ incident, distanceMi }: { incident: PublicIncident; distanceMi: number | null }) {
  const def = getCategory(incident.category);
  return (
    <Link
      href={`/incidents/${incident.id}`}
      transitionTypes={["nav-forward"]}
      className="press relative mt-2 block overflow-hidden rounded-[20px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full opacity-35 blur-3xl"
        style={{ background: def.color }}
        aria-hidden
      />
      <div className="relative flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-muted">
        <LiveBadge size="md" />
        <span>Happening now</span>
        {incident.isDemo && <DemoTag />}
      </div>
      <div className="relative mt-3 flex gap-3.5">
        <CategoryIcon category={incident.category} size="lg" animated glow />
        <div className="min-w-0 flex-1">
          <h3 className="text-[21px] font-extrabold leading-[1.15] tracking-[-0.03em]">{incident.title}</h3>
          <p className="mt-1 truncate text-[13.5px] text-muted">
            <span style={{ color: def.color }}>{def.short}</span>
            <span className="text-faint"> · </span>
            {incident.approximateAddress || "Approximate location"}
            {distanceMi != null && <span className="text-faint tnum"> · {formatDistance(distanceMi)}</span>}
            <span className="text-faint tnum"> · {timeAgo(incident.createdAt)}</span>
          </p>
        </div>
      </div>
      {incident.description && <p className="relative mt-3 line-clamp-2 text-[14.5px] leading-[1.45] text-text/80">{incident.description}</p>}
    </Link>
  );
}
