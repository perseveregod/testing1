import Link from "next/link";
import { getCategory } from "@/lib/categories";
import { formatDistance } from "@/lib/geo";
import { timeAgo } from "@/lib/time";
import type { PublicIncident } from "@/lib/types";
import { DemoTag } from "./Badges";
import { CategoryIcon } from "./CategoryIcon";

/** One incident as a list row: glyph, title, place, and a two-line preview. */
export function IncidentRow({ incident, distanceMi }: { incident: PublicIncident; distanceMi: number | null }) {
  const def = getCategory(incident.category);
  const ended = incident.status === "resolved";
  const active = incident.status === "active";
  return (
    <Link
      href={`/incidents/${incident.id}`}
      transitionTypes={["nav-forward"]}
      className="group -mx-4 flex gap-3.5 px-4 py-4 transition-colors active:bg-white/[0.03]"
    >
      <div className="relative pt-0.5">
        <CategoryIcon category={incident.category} muted={ended} />
        {active && incident.severity !== "low" && (
          <span className="absolute -right-0.5 top-0 size-2.5 rounded-full bg-danger ring-[2.5px] ring-bg" aria-label="Active" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className={`min-w-0 flex-1 truncate text-[16px] font-semibold tracking-[-0.015em] ${ended ? "text-muted" : ""}`}>
            {incident.title}
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
        {(incident.isDemo || ended || incident.confirmationCount > 0 || incident.unverified) && (
          <div className="mt-2 flex items-center gap-2.5 text-[12.5px] text-faint">
            {incident.isDemo && <DemoTag />}
            {ended && <span>Ended</span>}
            {incident.confirmationCount > 0 && <span className="tnum">{incident.confirmationCount} confirmed</span>}
            {incident.unverified && !incident.isDemo && <span>Unverified</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
